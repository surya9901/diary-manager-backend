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

app.listen(port, () => {
    console.log(`this app is listening to ${port}`)
})