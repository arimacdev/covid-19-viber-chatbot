require('dotenv').config();

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const async = require('async');

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
                        .then(async snapshot => {
                            if (snapshot.empty) {
                                console.log('No matching responses');
                                return res.status(400).send('Bad Message Request');
                            }

                            snapshot.forEach(async doc => {
                                if (doc.data().buttons)
                                    await SendMessage(id, doc.data().response, doc.data().buttons)
                                else
                                    SendMessagePlain(id, doc.data().response)
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

    return new Promise((async (resolve, reject) => {
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

            await async.each(buttonslist, async btn => {
                let createdBtn = await CreateButton(btn);
                kb.Buttons.push(createdBtn)
            });

            obj.keyboard = kb;
            resolve(obj);
        }

    }));

}


async function CreateButton(btn){
    let btn_requests = db.collection('buttons');

    let snapshot = await btn_requests.where('ActionBody', '==', btn).get();

    if (snapshot.empty) {
        console.log('No matching Buttons');
        return null;
    }

    let btnArr = await getBtnFromSnapshot(snapshot);

    return btnArr[0];
}

async function getBtnFromSnapshot(snapshot) {
    return new Promise(((resolve, reject) => {
        let returnArr = []
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
            returnArr.push(tempbtn);
        });
        resolve(returnArr)
    }))
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

    console.log("Object Sent", object);

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