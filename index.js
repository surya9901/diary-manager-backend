const port = process.env.PORT || 5000;

const express = require('express');
const app = express();
app.use(express.json());

const dotenv = require('dotenv');
dotenv.config();

const cors = require('cors');
app.use(cors({
    origin: "*"
}));

const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const url = process.env.DB || "mongodb://localhost:27017";

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const nodemailer = require('nodemailer');

function authenticate(req, res, next) {
    try {
        if (req.headers.authorization) {
            jwt.verify(req.headers.authorization, process.env.JWT_SECRET, (error, decoded) => {
                if (error) {
                    res.status(401).json({
                        message: "Unauthorized"
                    })
                } else {
                    req.userid = decoded.id
                    next()
                }
            })
        } else {
            res.status(401).json({
                message: "No Token Present"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
}

app.post("/register", async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary_manager")
        let duplicate_email = await db.collection("users").findOne({ "email": `${req.body.email}` })
        if (duplicate_email) {
            await client.close()
            res.status(204).json({
                message: "Duplicate Entry"
            })
        } else {
            // Hashing the password
            let salt = bcryptjs.genSaltSync(10);
            let hash = bcryptjs.hashSync(req.body.password, salt);
            req.body.password = hash;
            let data = await db.collection("users").insertOne(req.body)
            await client.close()
            res.json({
                message: "User Created",
                id: data._id
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.post('/login', async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary_manager")
        let user = await db.collection("users").findOne({ email: req.body.email })
        if (user) {
            let matchpassword = bcryptjs.compareSync(req.body.password, user.password)
            if (matchpassword) {
                let token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
                res.json({
                    message: "Logged in!",
                    token
                })
            } else {
                res.status(400).json({
                    message: "Username/Password incorrect"
                })
            }
        } else {
            res.status(400).json({
                message: "Username/Password incorrect"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong'
        })
    }
})

app.post("/create-memory", [authenticate], async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        const db = client.db("diary_manager")
        req.body.userid = req.userid
        const data = await db.collection("diary_details").insertOne(req.body)
        await client.close()
        res.json({
            message: "Memory added successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

app.get("/view-memory", [authenticate], async (req, res) => {
    try {
        const client = await mongoClient.connect(url)
        const db = client.db("diary_manager")
        const data = await db.collection("diary_details").find({ userid: req.userid }).toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

app.get("/view-memory-toEdit/:id", [authenticate], async (req, res) => {
    try {
        const client = await mongoClient.connect(url)
        const db = client.db("diary_manager")
        const data = await db.collection("diary_details").find({ _id: { $eq: mongodb.ObjectId(req.params.id) } }).toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

app.put("/edited-data/:id", [authenticate], async (req, res) => {
    try {
        const client = await mongoClient.connect(url)
        const db = client.db("diary_manager")
        const data = await db.collection("diary_details").updateMany({ _id: { $eq: mongodb.ObjectId(req.params.id) } }, { $set: { "title": `${req.body.title}`, "date": `${req.body.date}`, "memory": `${req.body.memory}` } })
        await client.close()
        res.json({
            message: "Edited Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

app.delete("/delete-data/:id", [authenticate], async (req, res) => {
    try {
        const client = await mongoClient.connect(url)
        const db = client.db("diary_manager")
        const data = await db.collection("diary_details").findOneAndDelete({ _id: { $eq: mongodb.ObjectId(req.params.id) } })
        await client.close()
        res.json({
            message: "Deleted Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

app.get("/filtered-data", [authenticate], async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary_manager")
        let data = await db.collection("diary_details").find({ $or: [{ "date": { $eq: `${req.query.q}` } }, { "title": `${req.query.q}` }] }).collation({ locale: 'en', strength: 1 }).toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

app.get("/userName", [authenticate], async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary_manager")
        let data = await db.collection("users").find({ _id: mongodb.ObjectId(req.userid) }).toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

const contactEmail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: `${process.env.USER_NAME}`,
        pass: `${process.env.PASSWORD}`,
    },
});

contactEmail.verify((error) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready to Send");
    }
});

app.post("/forgot-password-email", async (req, res) => {
    let resetPin = (Math.floor(100000 + Math.random() * 900000))
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary_manager")
        let data = await db.collection("users").findOneAndUpdate({ email: req.query.q }, { $set: { PIN: resetPin } })
        if (data.value) {
            const message = resetPin;
            const mail = {
                from: `E-diary <${process.env.USER_NAME}>`,
                to: req.query.q,
                subject: "E-Diary Password Reset OTP",
                html:
                    `<h2>Hi User, This is your reset pin ${message}</h2>`
            };
            contactEmail.sendMail(mail, (error) => {
                if (error) {
                    res.json({ status: "ERROR" });
                } else {
                    res.json({ status: "Message Sent" });
                }
            });
            await client.close()
        } else {
            res.status(404).json({
                message: "No user Found!"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "No user ID found"
        })
    }
});

app.post("/verify-otp", async (req, res) => {
    try {
        const client = await mongoClient.connect(url)
        const db = client.db("diary_manager")
        const data = await db.collection("users").findOne({ email: req.body.email })
        if (data) {
            if (data.PIN == req.body.PIN) {
                await db.collection("users").findOneAndUpdate({ email: data.email }, { $set: { PIN: "" } })
                await client.close()
                res.json({
                    message: "Success"
                })
            } else {
                res.status(402).json({
                    message: "Invalid OTP"
                })
            }
        } else {
            res.status(500).json({
                message: "To much Traffic"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "To much Traffic"
        })
    }
})

app.post("/new-pass-word", async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary_manager")
        let data = await db.collection("users").findOne({ "email": `${req.body.email}` })
        if (data) {
            let salt = bcryptjs.genSaltSync(10);
            let hash = bcryptjs.hashSync(req.body.password, salt);
            req.body.password = hash;
            await db.collection("users").findOneAndUpdate({ email: data.email }, { $set: { password: req.body.password } })
            await client.close()
            res.json({
                message: "Password updated",
            })
        } else {
            await client.close()
            res.status(500).json({
                message: "Something went wrong"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.listen(port, () => {
    console.log(`this app is listening to ${port}`)
})