const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oq7g3og.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();

        const usersCollection = client.db("polyglotDB").collection("users");
        const languageClassesCollection = client.db("polyglotDB").collection("languageClasses");
        const addedClassesCollection = client.db("polyglotDB").collection("addedClasses");
        const enrolledClassesCollection = client.db("polyglotDB").collection("enrolledClasses");
        const paymentCollection = client.db("polyglotDB").collection("payments");


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })

            res.send({ token })
        })

        //admin verify
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }


        // users apis
        app.get('/allusers', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        // check student
        app.get('/users/student/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ student: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { student: user?.role === 'student' }
            res.send(result);
        })

        // check instructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })




        // language class api
        app.get('/languageClasses', async (req, res) => {
            const result = await languageClassesCollection.find().toArray();
            res.send(result);
        })

        app.post('/languageClasses', verifyJWT, async (req, res) => {
            const newData = req.body;
            const result = await languageClassesCollection.insertOne(newData)
            res.send(result);
        })

        app.patch('/languageClasses/approve/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };

            const result = await languageClassesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/languageClasses/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedFeedback = req.body;

            const updateDoc = {
                $set: {
                    feedback: updatedFeedback.feedback,
                }
            }

            const result = await languageClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/languageClasses/denied/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };

            const result = await languageClassesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        //classes api
        app.get('/addedClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { userEmail: email };
            const result = await addedClassesCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/addedClasses', async (req, res) => {
            const item = req.body;
            const query = { userEmail: item.userEmail, className: item.className }
            const existingClass = await addedClassesCollection.findOne(query);

            if (existingClass) {
                return res.send({ message: 'user already exists' })
            }

            const result = await addedClassesCollection.insertOne(item);
            res.send(result);
        })

        app.delete('/addedClasses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await addedClassesCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/enrolledClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await enrolledClassesCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/myClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { instructorEmail: email };
            const result = await languageClassesCollection.find(query).toArray();
            res.send(result);
        });


        // payment
        // create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { classId: payment.classID, userEmail: payment.email };
            const deleteResult = await addedClassesCollection.deleteOne(query);

            const classQuery = { _id: new ObjectId(payment.classID) };
            const classUpdate = {
                $inc: { totalEnrolledStudent: 1, availableSeats: -1 }
            };
            const updatedClass = await languageClassesCollection.updateOne(classQuery, classUpdate);
            const enrolledclass = await enrolledClassesCollection.insertOne(payment);
            res.send({ insertResult, deleteResult, updatedClass });
        })

        app.get('/paymentHistories', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Polyglot server is running')
})

app.listen(port, () => {
    console.log(`Polyglot server is running on port ${port}`);
})
