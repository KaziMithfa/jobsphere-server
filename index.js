const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6salq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const jobsCollection = client.db("jobSphere").collection("jobs");
    const appliedjobsCollection = client
      .db("jobSphere")
      .collection("appliedjobs");

    // jwt generate

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.node_ENV === "production",
          sameSite: process.env.node_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Get all jobs data from db
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    // Get a single job data from db
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // getting all posted jobs for a specified user
    app.get("/jobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // getting all applied jobs for a specfic user
    app.get("/appliedJobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const filter = req.query.filter;
      if (filter) {
        query.category = filter;
      }
      const result = await appliedjobsCollection.find(query).toArray();
      res.send(result);
    });

    // add a single job in the database

    app.post("/job", async (req, res) => {
      const data = req.body;
      const result = await jobsCollection.insertOne(data);
      res.send(result);
    });

    // add an applied job information in the database
    app.post("/appliedjob", async (req, res) => {
      const data = req.body;

      // check where the user applied for this job before
      const query = {
        email: data.email,
        jobId: data.jobId,
      };

      const alreadyApplied = await appliedjobsCollection.findOne(query);
      if (alreadyApplied) {
        return res.status(400).send("You have already applied for this job");
      }

      const result = await appliedjobsCollection.insertOne(data);

      const updateDoc = {
        $inc: { jobApplicants: 1 },
      };

      const jobquery = { _id: new ObjectId(data.jobId) };
      const updateJobApplicant = await jobsCollection.updateOne(
        jobquery,
        updateDoc
      );
      console.log(updateJobApplicant);
      res.send(result);
    });

    // updating a  job by the user

    app.put("/job/:id", async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;

      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          ...jobData,
        },
      };

      const result = await jobsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // deleting a job by the user

    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    // getting all jobs for pagination

    app.get("/all-jobs", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const search = req.query.search;

      let query = {
        jobTitle: { $regex: search, $options: "i" },
      };

      const result = await jobsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // get all jobs data count for db

    app.get("/jobs-count", async (req, res) => {
      const search = req.query.search;

      let query = {
        jobTitle: { $regex: search, $options: "i" },
      };
      const count = await jobsCollection.countDocuments(query);
      res.send({ count });
    });

    //await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from JobSphere Server");
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
