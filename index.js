const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const ngrok = require('@ngrok/ngrok');
const dotenv = require('dotenv').config();
const distance = require('google-distance-matrix');
const { chownSync } = require('fs');

const app = express();
app.use(bodyParser.json());

distance.key(process.env.DISTANCE_KEY);

let rideDetails = [];
let riderName, pickupLocation, dropLocation, passengerNumber, sharingChoice, pickupToDrop;

function otpMaker() {
  return Math.floor(Math.random() * (9999 - 1000 + 1) ) + 1000;
}

function idMaker() {
  let id = Math.floor(Math.random() * (9999 - 1000 + 1) ) + 1000;
  for(let val of rideDetails) {
    if(val.ID == id) {
      return idMaker()
    }
    else {
      return `DM${id}`;
    }
  }
}

app.post('/', (req, res) => {
  const { queryResult } = req.body;
  let userIntent = queryResult.intent.displayName;

  if(userIntent == "FindRide") {
    pickupLocation = queryResult.parameters['geo-city'];
    dropLocation = queryResult.parameters['geo-city1'];
    passengerNumber = queryResult.parameters.number;
    sharingChoice = queryResult.parameters.RidingPreference;
    
    if(passengerNumber > 4) {
      res.json({
          "fulfillmentText": 'Sorry, only 4 persons can sit in a cab. \nYou have to book multiple cabs if you have more passengers. Please try again.'
      });
    }

    const origin = [pickupLocation];
    const destination = [dropLocation];
    let count = 0;
    distance.matrix(origin, destination, (err, distances) => {
      if(!err) {
        if (distances.rows[0].elements[0] && distances.rows[0].elements[0].distance) {
          pickupToDrop = distances.rows[0].elements[0].distance.text;
        } else {
          count++;
          res.json({
            "fulfillmentText": "Sorry, we can't arrange a cab for the given details. Please try again with different inputs"
          });
        }
      }
    });
    if(count === 0) {
      res.json({
        "fulfillmentText": "Sure, I'll try to find a cab for you. Please tell me your name."
      });
    }
  }

  if(userIntent == "getName") {
    riderName = queryResult.parameters.person.name;
    res.json({
      "fulfillmentText": `Great! So a cab from ${pickupLocation} to ${dropLocation} for ${passengerNumber} passengers in ${sharingChoice} and the booking is done by ${riderName}. Are all the details correct?`
  });
  }
  
  if(userIntent == "getName - yes") {
    if(sharingChoice == "shared" && sharingChoice == "Shared") {
      let count = 0;
      for(let val of rideDetails) {
        const seatLeft = 4 - (val.passengerNumber);
        if(passengerNumber <= seatLeft && pickupLocation == val.pickupLocation && dropLocation == val.dropLocation) {
          val.passengerNumber += passengerNumber;
          val.sharedFare = val.totalFare / passengerNumber;
          let otp = otpMaker();
          console.log(rideDetails);
          res.json({
            "fulfillmentMessages": [
              {
                "card": {
                  "title": `Booking ID: ${val.ID}`,
                  "subtitle": `Please share one time OTP ${otp} at the start of ride.\nPickup Location: ${pickupLocation}\nDrop Location: ${dropLocation}\nDistance: ${pickupToDrop}`,
                  "imageUri" : "https://images.unsplash.com/photo-1584910587543-0be41319822c?q=80&w=1104&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
                  "buttons": [
                    {
                      "text": "Track Ride",
                      "postback": `Track my ride for Booking ID: ${val.ID}`
                    },
                    {
                      "text": "Book another cab",
                      "postback": "Book a cab"
                    },
                    {
                      "text" : "Show Fare",
                      "postback": `Show my fare for ${val.ID}`
                    }
                  ]
                },
                "platform" : "TELEGRAM"
              },
              {
                "text": {
                  "text": [
                    `Yay! We found a cab ride for you. Your booking ID is ${val.ID}. Also please share one time OTP ${otp} at the start of ride. Happy Journey`
                  ]
                }
              }
            ]
          });
          count++;
          break;
        }
      }
      if(count === 0) {
        res.json({
          "fulfillmentText": `Sorry, we currently don't have any shared cabs available for ${passengerNumber} passengers. We recommend booking a private cab or try again later maybe`
        });
      }
    }
    else {
      if(sharingChoice == "private" || sharingChoice == "Private") {
        rideDetails.push({
          pickupLocation,
          dropLocation,
          passengerNumber,
          sharingChoice
        });
      }
      let val = rideDetails[(rideDetails.length)-1].ID = idMaker();
      let otp = otpMaker();
      rideDetails[(rideDetails.length)-1].pickupToDrop = pickupToDrop;
      function fareCalculator(pickupToDrop) {
        return parseInt(pickupToDrop.replace(/\D/g, ''), 10) * 6;
      }
      let fare = fareCalculator(pickupToDrop);
      rideDetails[(rideDetails.length)-1].totalFare = fare;
      rideDetails[(rideDetails.length)-1].sharedFare = fare/passengerNumber;
      console.log(rideDetails);

      res.json({
        "fulfillmentMessages": [
          {
            "card": {
              "title": `Booking ID: ${val}`,
              "subtitle": `Please share one time OTP ${otp} at the start of ride.\nPickup Location: ${pickupLocation}\nDrop Location: ${dropLocation}\nDistance: ${pickupToDrop}`,
              "imageUri" : "https://images.unsplash.com/photo-1584910587543-0be41319822c?q=80&w=1104&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
              "buttons": [
                {
                  "text": "Track Ride",
                  "postback": `Track my ride for Booking ID: ${val}`
                },
                {
                  "text": "Book another cab",
                  "postback": "Book a cab"
                },
                {
                  "text" : "Show Fare",
                  "postback": `Show my fare for ${val}`
                }
              ]
            },
            "platform" : "TELEGRAM"
          },
          {
            "text": {
              "text": [
                `Yay! We found a cab ride for you. Your booking ID is ${val}. Also please share one time OTP ${otp} at the start of ride. Happy Journey`
              ]
            }
          }
        ]
      });
    }
  }

  if(userIntent == "getName - no") {
    res.json({
      "fulfillmentText": `If your details are incorrect, please try again from start!`
    });
  }

  if(userIntent == "trackRide") {
    let count = 0;
    const ID = `DM${queryResult.parameters.number}`;
    const time = () => Math.floor(Math.random() * (25 - 5 + 1) ) + 5;
    for(let val of rideDetails) {
      if(val.ID == ID) {
        res.json({
          "fulfillmentText": `Your ride will arrive in ${time()} minutes; Thank you for your patience.`
        });
        count++;
        break;
      }
    }
    if(count === 0) {
      res.json({
        "fulfillmentText": `That is not a valid ID.`
      });
    }
  }

  if(userIntent == "showFare") {
    let count = 0;
    const ID = `DM${queryResult.parameters.number}`;
    for(let val of rideDetails) {
      if(val.ID == ID) {
        res.json({
          "fulfillmentText": `The fare for each passenger is Rs.${val.sharedFare}. Please pay only after ride is completed!`
        });
        count++;
        break;
      }
    }
    if(count === 0) {
      res.json({
        "fulfillmentText": `That is not a valid ID.`
      });
    }
  }

});

app.listen(3000, () => {
    console.log("Listening to port 3000!");
    ngrok.connect({ addr: 3000, authtoken_from_env: true })
  .then(listener => console.log(`Ingress established at: ${listener.url()}`));
});