import express from "express";
import db from "../db";
import axios from "axios";

const router = express.Router();

router.post("/hybridAI", async (req, res) => {

try{

const message =
req.body.message.toLowerCase();

const phone =
req.body.phone;

let reply="";


// DATABASE QUESTIONS

if(
message.includes("my animals") ||
message.includes("animals") ||
message.includes("mifugo yangu")
){

const animals =
await db("livestock")
.where("phone", phone);

reply =
"You have "+
animals.length+
" animals registered.";

return res.json({reply});

}


// APPOINTMENTS

if(message.includes("appointment")){

const appointments =
await db("appointments")
.where("phone", phone);

reply=
"You have "+
appointments.length+
" appointments.";

return res.json({reply});

}


// ORDERS

if(message.includes("orders")){

const orders=
await db("orders")
.where("phone",phone);

reply=
"You have "+
orders.length+
" orders.";

return res.json({reply});

}


// OTHERWISE USE AI

const aiResponse=
await axios.post(
"https://api.openai.com/v1/chat/completions",
{

model:"gpt-4o-mini",

messages:[
{
role:"system",
content:`

You are SmartLivestock AI Assistant.

Support:

English
Swahili

Help farmers.

Short answers.

`
},

{
role:"user",
content:message
}

]

},

{

headers:{
Authorization:
`Bearer ${process.env.OPENAI_KEY}`
}

}

);

reply=
aiResponse.data
.choices[0]
.message.content;

res.json({reply});

}catch(error){

res.json({

reply:
"SmartLivestock AI temporarily offline"

});

}

});

export default router;