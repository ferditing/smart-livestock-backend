import express from "express";
import db from "../db";

const router = express.Router();

router.post("/tidio", async (req, res) => {

try{

const message = req.body.message;

const userPhone = req.body.phone;

let reply="I can help with livestock information.";


// ANIMAL COUNT

if(message.includes("animals")){

const animals = await db("livestock")
.where("phone", userPhone);

reply =
"You have "+
animals.length+
" animals registered.";

}


// APPOINTMENTS

else if(message.includes("appointment")){

const appointments =
await db("appointments")
.where("phone",userPhone);

reply =
"You have "+
appointments.length+
" vet appointments.";

}


// ORDERS

else if(message.includes("orders")){

const orders =
await db("orders")
.where("phone",userPhone);

reply =
"You have "+
orders.length+
" orders.";

}


res.json({

reply

});

}catch(error){

res.json({

reply:"System unavailable"

});

}

});

export default router;