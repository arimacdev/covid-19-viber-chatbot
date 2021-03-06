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

    console.info('Message :' + JSON.stringify(req.body));

    try {

        if (req.body.event === "message") {

            const id = req.body.sender.id;
            if (id) {
                console.info('Message :' + JSON.stringify(req.body));

                //Statistics
                if (req.body.message.text === "1_en_1" || req.body.message.text === "1_si_1" || req.body.message.text === "1_ta_1") {
                    await CheckLKStats(id, req.body.message.text);
                }

                try {
                    let requests = db.collection('responses');

                    let query = requests.where('request', '==', req.body.message.text)
                        .get()
                        .then(async snapshot => {
                            if (snapshot.empty) {
                                //console.log('No matching responses');

                                SendDefault(id);

                                return false;
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

        } else if (req.body.event === "conversation_started") {

            const uid = req.body.user.id;

            if (uid) {
                const obj = {
                    receiver: uid,
                    sender: {
                        name: process.env.BOT_NAME
                    },
                    type: "text",
                    text: "Welcome to COVID-19 Sri Lanka Chatbot. Be with us to get recent and valid information on the Coronavirus epidemic.\n\nPlease Choose a language below to start 👇🏽👇🏽",
                    keyboard : {
                        Type: "keyboard",
                        DefaultHeight: true,
                        BgColor: "#FFFFFF",
                        InputFieldState: "hidden",
                        Buttons: [{
                            ActionBody: "lang_en",
                            Text: "English",
                            Columns: 6,
                            Rows: 1,
                            BgColor: "#eeeeee",
                            BgLoop: true,
                            ActionType: "reply",
                            TextVAlign: "middle",
                            TextHAlign: "center",
                            TextSize: "large"
                        },{
                            ActionBody: "lang_si",
                            Text: "සිංහල",
                            Columns: 6,
                            Rows: 1,
                            BgColor: "#eeeeee",
                            BgLoop: true,
                            ActionType: "reply",
                            TextVAlign: "middle",
                            TextHAlign: "center",
                            TextSize: "large"
                        },{
                            ActionBody: "lang_ta",
                            Text: "தமிழ்",
                            Columns: 6,
                            Rows: 1,
                            BgColor: "#eeeeee",
                            BgLoop: true,
                            ActionType: "reply",
                            TextVAlign: "middle",
                            TextHAlign: "center",
                            TextSize: "large"
                        }]
                    }
                };

                SendOject(uid, obj);
                return res.status(200).send('Conversation Started Success');

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
        return res.status(400).send('Bad Request');
    }


});


async function GenerateButtons(receiver, msg, buttonslist) {

    return new Promise((async (resolve, reject) => {
        const obj = {
            receiver: receiver,
            sender: {
                name: process.env.BOT_NAME
            },
            type: "text",
            text: msg
        };

        const kb = {
            Type: "keyboard",
            DefaultHeight: true,
            BgColor: "#FFFFFF",
            InputFieldState: "hidden",
            Buttons: []
        }

        if (buttonslist.length > 0) {

            await async.each(buttonslist, async btn => {
                let createdBtn = await CreateButton(btn);
                kb.Buttons.push(createdBtn)
            });

            //sort the buttons by ActionBody
            kb.Buttons.sort((a,b)=> (a.ActionBody>b.ActionBody) ? 1 : -1);

            obj.keyboard = kb;
            resolve(obj);
        }

    }));

}


async function CreateButton(btn) {
    let btn_requests = db.collection('buttons');

    let snapshot = await btn_requests.where('ActionBody', '==', btn).get();

    if (snapshot.empty) {
        //console.log('No matching Buttons');
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

            returnArr.push(tempbtn);
        });
        resolve(returnArr)
    }))
}


async function SendMessage(receiver, msg, buttonslist) {
    var object = await GenerateButtons(receiver, msg, buttonslist);

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
            name: process.env.BOT_NAME
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

async function SendOject(obj) {

    await axios.post('https://chatapi.viber.com/pa/send_message', obj, {
        headers: {
            'Content-Type': 'application/json',
            'X-Viber-Auth-Token': authkey
        }
    });
}

function SendDefault(id) {
    const obj = {
        receiver: id,
        sender: {
            name: process.env.BOT_NAME
        },
        type: "text",
        text: "Hi, I am sorry I cannot understand what you said.\n\nPlease choose your language 👇",
        keyboard : {
            Type: "keyboard",
            DefaultHeight: true,
            BgColor: "#FFFFFF",
            InputFieldState: "hidden",
            Buttons: [{
                ActionBody: "lang_en",
                Text: "English",
                Columns: 6,
                Rows: 1,
                BgColor: "#eeeeee",
                BgLoop: true,
                ActionType: "reply",
                TextVAlign: "middle",
                TextHAlign: "center",
                TextSize: "large"
            },{
                ActionBody: "lang_si",
                Text: "සිංහල",
                Columns: 6,
                Rows: 1,
                BgColor: "#eeeeee",
                BgLoop: true,
                ActionType: "reply",
                TextVAlign: "middle",
                TextHAlign: "center",
                TextSize: "large"
            },{
                ActionBody: "lang_ta",
                Text: "தமிழ்",
                Columns: 6,
                Rows: 1,
                BgColor: "#eeeeee",
                BgLoop: true,
                ActionType: "reply",
                TextVAlign: "middle",
                TextHAlign: "center",
                TextSize: "large"
            }]
        }
    };

    SendOject(obj);
}

async function CheckLKStats(receiver, lan) {
    console.log("Checking LK Stats");

    const dataObj = {
        total: 0,
        new: 0,
        treatment: 0,
        recovered: 0,
        deaths: 0
    }

    var msg = "";

    await axios.get('https://www.hpb.health.gov.lk/api/get-current-statistical').then(api_response => {
        // eslint-disable-next-line promise/always-return
        if (api_response.data.success) {

            console.log(api_response.data.data.local_total_cases);

            dataObj.total = api_response.data.data.local_total_cases;
            dataObj.new = api_response.data.data.local_new_cases;
            dataObj.treatment = api_response.data.data.local_total_number_of_individuals_in_hospitals;
            dataObj.recovered = api_response.data.data.local_recovered;
            dataObj.deaths = api_response.data.data.local_deaths;

            if (lan === "1_si_1")
                msg = "😷 මුළු රෝගීන් : " + dataObj.total
                    + " \n\n🤒 නව රෝගීන් : " + dataObj.new
                    + " \n\n🏥 රෝහල් ගත : " + dataObj.treatment
                    + " \n\n💚 සුවය ලබා පිටව ගිය : " + dataObj.recovered
                    + " \n\n😢 මරණ සංඛ්‍යාව : " + dataObj.deaths;
            else if (lan === "1_ta_1")
                msg = "😷 மொத்த நோயாளிகள் : " + dataObj.total
                    + " \n\n🤒 புதிய நோயாளிகள் : " + dataObj.new
                    + " \n\n🏥 மருத்துவமனைகளில் உள்ள மொத்த நபர்களின் எண்ணிக்கை : " + dataObj.treatment
                    + " \n\n💚 தேறியோர் மற்றும் குணமடைந்து வெளியேறியோர் : " + dataObj.recovered
                    + " \n\n😢 இறப்புக்கள் : " + dataObj.deaths;
            else
                msg = "😷 Total Cases : " + dataObj.total
                    + " \n\n🤒 New Cases today : " + dataObj.new
                    + " \n\n🏥 Treating in Hospitals : " + dataObj.treatment
                    + " \n\n💚 Recovered and Discharged : " + dataObj.recovered
                    + " \n\n😢 Deaths : " + dataObj.deaths;

            
            SendMessagePlain(receiver, msg);

        } else {
            if (lan === "1_si_1")
                msg = "සමාවන්න. මට දත්ත ලබාගැනීමේ ගැටළුවක් ඇතිවිය. නැවත උත්සාහ කරන්න.";
            else if (lan === "1_ta_1")
                msg = "Tamil Sorry, I am unable to look for info";
            else
                msg = "Sorry, I am unable to look for info. Please try again";
        }

    });
}



//Export the API to Firebase Cloud Functions
exports.app = functions.https.onRequest(app);