require('dotenv').config();

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const authkey = process.env.AUTH_KEY;

var serviceAccount = require("./account-permissions.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://covid-19-dashboard-25165.firebaseio.com"
});


const app = express();

const db = admin.firestore();

app.use(cors({ origin: true }));

app.post('/message', async (req, res) => {

    try {

        if (req.body.event === "message") {
            console.log("Message");

            const id = req.body.sender.id;
            if (id) {
                console.info('Message :' + JSON.stringify(req.body.message.text));

                try {
                    let requests = db.collection('responses');

                    let query = requests.where('request', '==', req.body.message.text)
                        .get()
                        .then(snapshot => {
                            if (snapshot.empty) {
                                console.log('No matching responses');
                                return res.status(400).send('Bad Message Request');
                            }

                            snapshot.forEach(response => {

                                if (response.data().buttons)
                                    SendMessage(id, response.data().response, response.data().buttons)
                                else
                                    SendMessagePlain(id, response.data().response)

                            });

                            return true;
                        }).catch(err => {
                            console.log(err);
                            return false;
                        });

                    return res.status(200).send('Success');


                } catch (error) {
                    return res.status(400).send('Bad Message Request');
                }

                //search responses for the request

            }
            else {
                return res.status(400).send('Bad Message Request');
            }

        } else {
            return res.status(400).send('Bad Message Request');
        }



    }
    catch (error) {
        console.log(error);
        return res.status(400).send('error');
    }


});


async function GenerateButtons(receiver, msg, buttonslist) {

    return new Promise(((resolve, reject) => {
        const obj = {
            receiver: receiver,
            sender: {
                name: "BOT"
            },
            type: "text",
            text: msg
        };

        const kb = {
            Type: "keyboard",
            BgColor: "#FFFFFF",
            Buttons: []
        }

        if (buttonslist.length > 0) {

            for (const btn of buttonslist) {
                kb.Buttons.push(CreateButton(btn));
            }

            obj.keyboard = kb;
            console.log(obj);
            resolve(obj);
        }

    }));

}


async function CreateButton(btn){
    let btn_requests = db.collection('buttons');
    console.log(btn);

    let btn_query = await btn_requests.where('ActionBody', '==', btn)
        .get()
        .then(snapshot => {
            // eslint-disable-next-line promise/always-return
            if (snapshot.empty) {
                console.log('No matching Buttons');
                return null;
            }

            snapshot.forEach(btnres => {

                var tempbtn = {
                    ActionBody: btnres.data().ActionBody,
                    Text: btnres.data().Text,
                    Columns: 6,
                    Rows: 1,
                    BgColor: "#eeeeee",
                    BgLoop: true,
                    ActionType: "reply",
                    TextVAlign: "middle",
                    TextHAlign: "center",
                    TextSize: "large"
                }

                console.log("Pushing button " + tempbtn.Text);
                //kb.Buttons.push(tempbtn);
                return tempbtn;

            });


        }).catch(err => {
            console.log(err);
            return null;
        });
}

/** 
 * 
 * async function SendMessage(receiver, msg, buttonslist) {
    const obj = {
        receiver: receiver,
        sender: {
            name: "BOT"
        },
        type: "text",
        text: msg
    };

    const kb = {
        Type: "keyboard",
        BgColor: "#FFFFFF",
        Buttons: []
    }

    if (buttonslist.length > 0) {
        buttonslist.forEach(btn => {

            //call the DB again and get the values
            let btn_requests = db.collection('buttons');

            let btn_query = btn_requests.where('ActionBody', '==', btn)
                .get()
                .then(snapshot => {
                    // eslint-disable-next-line promise/always-return
                    if (snapshot.empty) {
                        console.log('No matching Buttons');
                    }

                    snapshot.forEach(btnres => {

                        var tempbtn = {
                            ActionBody: btnres.data().ActionBody,
                            Text: btnres.data().Text,
                            Columns: 6,
                            Rows: 1,
                            BgColor: "#eeeeee",
                            BgLoop: true,
                            ActionType: "reply",
                            TextVAlign: "middle",
                            TextHAlign: "center",
                            TextSize: "large"
                        }

                        console.log("Pushing button " + tempbtn);
                        kb.Buttons.push(tempbtn);

                    });


                }).catch(err => {
                    console.log(err);
                });

        });

        obj.keyboard = kb;

        console.log(obj);
    }

    console.log("Hello there!");

    await axios.post('https://chatapi.viber.com/pa/send_message', obj, {
        headers: {
            'Content-Type': 'application/json',
            'X-Viber-Auth-Token': '4b3f27110ce7df22-2896ab4b6b075162-6b404e3f1816f78f'
        }
    });
}
 * 
*/

async function SendMessage(receiver, msg, buttonslist) {

    var object = await GenerateButtons(receiver, msg, buttonslist);

    console.log("Object Sent");

    await axios.post('https://chatapi.viber.com/pa/send_message', object, {
        headers: {
            'Content-Type': 'application/json',
            'X-Viber-Auth-Token': authkey
        }
    });
}


async function SendMessagePlain(receiver, msg) {
    const obj = {
        receiver: receiver,
        sender: {
            name: "BOT"
        },
        type: "text",
        text: msg
    };


    await axios.post('https://chatapi.viber.com/pa/send_message', obj, {
        headers: {
            'Content-Type': 'application/json',
            'X-Viber-Auth-Token': authkey
        }
    });
}



//Export the API to Firebase Cloud Functions
exports.app = functions.https.onRequest(app);