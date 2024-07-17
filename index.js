const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// jwt
const jwt = require("jsonwebtoken");

// middleware
app.use(cors());
app.use(express.json());

// jwt verify middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7u3xyjj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const homeCollection = client.db("homeDb").collection("homes");
    // const reviewCollection = client.db("homeDb").collection("reviews");
    const watchCollection = client.db("homeDb").collection("watch");
    const usersCollection = client.db("homeDb").collection("users");
    const bookingCollection = client.db("homeDb").collection("bookings");
    const paymentCollection = client.db("homeDb").collection("payments");

    // jwt api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "12h",
      });
      res.send({ token });
    });

    // verifyAdmin middleware (verifyAdmin works after verifyJWT)
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // user related api
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // app.delete("/users/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await usersCollection.deleteOne(query);
    //   res.send(result);
    // });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      console.log("existingUser", existingUser);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body;
      console.log(role);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          ...role,
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // home list  related api
    app.get("/home", async (req, res) => {
      const result = await homeCollection.find().toArray();
      res.send(result);
    });
    // routes for single card info
    app.get("/home/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id };
      const result = await homeCollection.findOne(filter);
      res.send(result);
    });

    app.post("/home", verifyJWT, verifyAdmin, async (req, res) => {
      const newHome = req.body;
      const result = await homeCollection.insertOne(newHome);
      res.send(result);
    });

    app.delete("/api/aHome/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(typeof id);
      // my data isnt objectId ,so I dont use new ObjectId
      const query = { _id: id };
      const result = await homeCollection.deleteOne(query);
      res.send(result);
    });

    // app.get("/reviews", async (req, res) => {
    //   const result = await reviewCollection.find().toArray();
    //   res.send(result);
    // });

    // watch collection
    app.get("/watch", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      // jwt token check
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res
          .status(401)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await watchCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/watch", async (req, res) => {
      const watch = req.body;
      console.log(watch);
      const result = await watchCollection.insertOne(watch);
      res.send(result);
    });

    app.delete("/watch/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await watchCollection.deleteOne(query);
      res.send(result);
    });

    // POST endpoint for booking
    app.post("/bookings", verifyJWT, async (req, res) => {
      try {
        const bookingData = req.body;
        const result = await bookingCollection.insertOne(bookingData);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error creating booking:", error);
        res
          .status(500)
          .send({ error: true, message: "Failed to create booking" });
      }
    });

    // GET endpoint for bookings
    app.get("/bookings", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const bookings = await bookingCollection.find().toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error retrieving bookings:", error);
        res
          .status(500)
          .send({ error: true, message: "Failed to retrieve bookings" });
      }
    });

    // payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      console.log(price, amount);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: { $in: payment.watchesItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await watchCollection.deleteMany(query);

      res.send({ insertResult, deleteResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Home is open for all");
});

app.listen(port, () => {
  console.log(`Home is open for all on port ${port}`);
});
