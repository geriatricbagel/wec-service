const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const Multer = require("multer");
const { format } = require("util");
const { Storage } = require("@google-cloud/storage");
const fs = require("fs");
const helmet = require("helmet");
const ms = require("mediaserver");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const nJwt = require("njwt");
const cookieParser = require("cookie-parser");
const User = require("./mongoose/models/users");
const Speaker = require("./mongoose/models/speakers");
const Series = require("./mongoose/models/series");
const Sermon = require("./mongoose/models/sermons");
const Event = require("./mongoose/models/event");
const Message = require("./mongoose/models/message");
const querystring = require("querystring");
const News = require("./mongoose/models/news");
const sanitizeHtml = require("sanitize-html");
const app = express();
const port = process.env.PORT || 8080;
const keyFilename = "./gac.json";
const projectId = "whitby-evangelical-church";
const nodemailer = require("nodemailer");

app.use(cors());

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(helmet());

app.use(bodyParser.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "build")));

require("dotenv").config();

//let testUpload = multer()

const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 1000 * 1024 * 1024,
  },
});

const storage = new Storage({ projectId, keyFilename });

const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

/*let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public')
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    }
})*/

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error"));
db.on("open", () => console.log("db is connected"));

app.use(passport.initialize());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      console.log("hello there");
      User.findOne({ email: email }, (err, user) => {
        if (err) {
          console.log("Errory Boi");
          return done(err);
        }
        if (!user) {
          console.log("no user!");
          return done(null, false, { message: "Incorrect username" });
        }
        if (!bcrypt.compareSync(password, user.password)) {
          console.log("wrong password!");
          return done(null, false, { message: "Incorrect password." });
        }
        console.log("all good");
        return done(null, user);
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

createJWT = (username, permissions) => {
  const claims = {
    sub: username,
    isAdmin: permissions,
    iss: "whitbyec",
  };

  const jwt = nJwt.create(claims, process.env.SECRET_KEY);
  const token = jwt.compact();
  return token;
};

verifyJWT = (token) => {
  let data;
  try {
    data = nJwt.verify(token, process.env.SECRET_KEY);
    return data.body;
  } catch (error) {
    return null;
  }
};

var transporter = nodemailer.createTransport({
  auth: {
    user: 'contact@acalebwilson.com',
    pass: process.env.EMAIL_PASSWORD
  }
});


app.post("/api/contact", (req, res) => {

  var mailOptions = {
    from: 'contact@acalebwilson.com',
    to: 'a.caleb.wilson@gmail.com',
    subject: req.body.name,
    text: req.body.message
  };
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });

  if (req.body.name && req.body.date && req.body.email && req.body.message) {
    let message = new Message({
      name: req.body.name,
      email: req.body.email,
      date: req.body.date,
      message: req.body.message,
    });

    message.save(err => {
      if (err) res.status(400).send("Database Error")
      res.status(200).send("Message Sent")
    })
  } else {
    res.status(400).send("Invalid Request")
  }
});

app.get("/api/messages", checkUser, async (req, res) => {
  let messages = await Message.find()
  if (messages) {
    return res.json({messages})
  } else {
    return res.status(400).send("Error")
  }
})

app.post("/api/login", passport.authenticate("local"), (req, res) => {
  let token = createJWT(req.user.email, req.user.isAdmin);
  res.cookie("token", token, {}).json({
    user: {
      username: req.user.email,
      isAdmin: req.user.isAdmin,
    },
  });
});

// Verifies if the user is logged in, called on initial component mount of App

app.get("/api/verify", (req, res) => {
  let cookie = req.cookies.token;
  let data = verifyJWT(cookie);
  if (data) {
    res.json({
      verified: true,
      user: data,
    });
  } else {
    res.json({
      verified: false,
    });
  }
});

app.get("/api/logout", (req, res) => {
  res.clearCookie("token");
  req.logout();
  res.json({ message: "logged out" });
});

app.post("/api/data/", async (req, res) => {
  let responseJSON = {};
  console.log(req.body);
  if (checkJSONBoolean(req.body.verified)) {
    let cookie = req.cookies.token;
    let data = verifyJWT(cookie);
    if (data) {
      responseJSON.userDetails = { verified: true, user: data };
    } else {
      responseJSON.userDetails = { verified: false };
    }
  }
  if (checkJSONBoolean(req.body.speakers)) {
    let speakers = await Speaker.find();
    if (speakers) {
      responseJSON.speakers = speakers;
    }
  }
  if (checkJSONBoolean(req.body.sermons)) {
    let sermons = await Sermon.find();
    if (sermons) {
      responseJSON.sermons = sermons;
    }
  }
  if (checkJSONBoolean(req.body.events)) {
    let events = await Event.find();
    if (events) {
      responseJSON.events = events;
    }
  }

  res.json(responseJSON);
});

const checkJSONBoolean = (value) => {
  console.log(typeof value);
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    } else {
      return false;
    }
  } else {
    return value;
  }
};

/*app.post("/upload-audio", (req, res) => {
    let audioUpload = multer({storage: storage}).single('file')
    audioUpload(req, res, err => {
        if (err) {
            return res.json(err)
        }
        return res.send(req.file)
    })
})*/

/*app.post("/api/register", async (req, res) => {
    let user = await User.findOne({email: req.body.email})
    if (user) {
        res.status(400).send("Email already registered")
    }
    let password = await bcrypt.hash(req.body.password, 12)
    let newUser = new User({email: req.body.email, password: password, fullName: "", picture: "", isAdmin: true});
    newUser.save((err, user) => {
        if (err) return res.status(400).send("Database Error")
        return res.send("Registration Successful")
    })
})*/

app.post(
  "/api/uploadAudio",
  checkUser,
  multer.single("file"),
  (req, res, next) => {
    console.log("file upload process begun");
    if (!req.file) {
      console.log("no file");
      res.status(400).send("No file uploaded");
      return;
    }

    console.log("creating blob");

    const blob = bucket.file(req.file.originalname);
    console.log("creating blob stream");
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on("finish", () => {
      const publicUrl = format(
        `https://storage.googleapis.com/${bucket.name}/${blob.name}`
      );
      console.log(publicUrl);
      res.status(200).send(publicUrl);
    });

    blobStream.end(req.file.buffer);
  }
);

app.post("/api/register", checkUser, async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    return res.status(400).send("Email already registered");
  }

  let newUser = new User({
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 12),
    fullName: req.body.fullName,
    picture: req.body.picture,
    isAdmin: true,
  });
  newUser.save((err, user) => {
    if (err) return res.json({ err: err });
    return res.send("Succesful Registration");
  });
});

function checkUser(req, res, next) {
  if (req.cookies.token) {
    let cookie = req.cookies.token;
    let data = verifyJWT(cookie);
    if (data) {
      next();
    } else {
      res.status(401).json({ success: false, message: "Unauthorised" });
    }
  } else {
    res.status(401).json({ success: false, message: "Unauthorised" });
  }
}

app.post("/api/addAudio", checkUser, (req, res) => {
  console.log(req.body);
  let date = new Date(req.body.date);
  console.log(date.getDate());
  let sermon = new Sermon({
    url: req.body.url,
    speaker: req.body.speaker,
    references: req.body.references,
    series: req.body.series,
    service: req.body.type,
    date: date,
  });
  sermon.save((err) => {
    if (err) return res.json({ success: false, message: "Database error" });
    return res.send("Successful Request");
  });
});

app.post("/api/editAudio", checkUser, async (req, res) => {
  let date = new Date(req.body.date);
  let sermon = await Sermon.findOne({ _id: req.body._id });
  (sermon.speaker = req.body.speaker),
    (sermon.date = date),
    (sermon.series = req.body.series),
    (sermon.service = req.body.type),
    (sermon.references = req.body.references);
  sermon.save((err) => {
    if (err) return res.json({ error: err });
    return res.send("Successful Request");
  });
});

app.post("/api/deleteAudio", checkUser, async (req, res) => {
  console.log("deleting: ", req.body.filename, req.body._id);
  await Sermon.deleteOne({ _id: req.body._id }, (err) => {
    if (err) console.log(err);
    console.log("success");
  });
  try {
    fs.unlink(process.cwd() + "/public/" + req.body.filename, (err) => {
      if (err) return res.json({ err: err });
      return res.send("Successful Request");
    });
  } catch (err) {
    res.json({ err: err });
  }
});

app.post("/api/addSpeaker", checkUser, async (req, res) => {
  let user = await Speaker.findOne({ fullName: req.body.fullName });
  if (!user) {
    let newUser = new Speaker({
      firstName: req.body.first,
      surname: req.body.surname,
      fullName: req.body.fullName,
      church: req.body.church,
    });
    newUser.save((err) => {
      if (err) return res.json({ success: false, message: "Database error" });
      return res.json({ success: true });
    });
  } else {
    res.json({ success: false, message: "Speaker already exists" });
  }
});

app.get("/api/getSpeakers", async (req, res) => {
  let speakers = await Speaker.find();
  res.json({ speakers: speakers });
});

app.post("/api/addSeries", checkUser, async (req, res) => {
  let series = await Series.findOne({ title: req.body.title });
  if (!series) {
    let newSeries = new Series({
      title: req.body.title,
      description: req.body.description,
    });
    newSeries.save((err) => {
      if (err) return res.json({ success: false, message: "Database error" });
      return res.json({ success: true });
    });
  } else {
    res.json({ success: false, message: "Series already exists" });
  }
});

app.get("/api/getSeries", async (req, res) => {
  let series = await Series.find();
  res.json({ series: series });
});

/*app.get("/sermon/:filename", (req, res) => {
    if (!fs.existsSync(process.cwd() + "/public/" + decodeURIComponent(req.params.filename))) {
        res.json({no: "no"})
    }
    const AudioFile = process.cwd() + "/public/" + decodeURIComponent(req.params.filename)
    ms.pipe(req, res, AudioFile)
})*/

// Returns the list of books, series, and speakers on/by which/whom have been preached.

app.get("/api/sermons/data", async (req, res) => {
  let data = await Sermon.find();
  let books = [];
  let series = [];
  let speakers = [];
  if (data) {
    data.map((item) => {
      if (!series.includes(item.series)) {
        series = [...series, item.series];
      }
      if (!speakers.includes(item.speaker)) {
        speakers = [...speakers, item.speaker];
      }
      item.references.map((item) => {
        if (item.type === "passage") {
          if (!books.includes(item.details.startBook)) {
            books = [...books, item.details.startBook];
          }
          if (!books.includes(item.details.endBook)) {
            books = [...books, item.details.endBook];
          }
        } else {
          if (!books.includes(item.details.book)) {
            books = [...books, item.details.book];
          }
        }
      });
    });
  }
  let bibleBooks = fs.readFileSync(process.cwd() + "/resources/bible.json");
  let bibleJson = await JSON.parse(bibleBooks);
  let bookList = bibleJson
    .filter((item) => {
      return books.includes(item.book);
    })
    .map((item) => item.book);
  res.json({ books: bookList, series: series, speakers: speakers });
});

const filterBook = (book, sermons) => {
  let filteredSermons = [];
  sermons.map((item) => {
    let valid = false;
    item.references.map((item) => {
      if ("book" in item) {
        if (item.book === book) {
          valid = true;
        }
      } else {
        if (item.start.book === book || item.end.book === book) {
          valid = true;
        }
      }
    });
    if (valid) {
      filteredSermons = [...filteredSermons, item];
    }
  });
  return filteredSermons;
};

const filterSeries = (series, sermons) => {
  let filteredSermons = [];
  sermons.map((item) => {
    if (item.series === series) {
      filteredSermons = [...filteredSermons, item];
    }
  });
  return filteredSermons;
};

app.get("/api/sermons/", async (req, res) => {
  let data = await Sermon.find();
  res.json({ sermons: data });
});

app.post("/api/addEvent", checkUser, (req, res) => {
  let start = new Date(req.body.startDate);
  let startTime = req.body.startTime.split(":");
  start.setHours(startTime[0]);
  start.setMinutes(startTime[1]);
  let end = null;
  if (req.body.endDate && req.body.endTime) {
    end = new Date(req.body.endDate);
    let endTime = req.body.endTime.split(":");
    end.setHours(endTime[0]);
    end.setMinutes(endTime[1]);
  }

  let event = new Event({
    title: req.body.title,
    description: req.body.description,
    start: start,
    end: end,
    speaker: req.body.speaker,
    repeat: req.body.repeat,
    type: req.body.type,
  });

  event.save((err) => {
    if (err) return res.json({ success: false });
    return res.json({ success: true });
  });
});

app.get("/api/events", async (req, res) => {
  let events = await Event.find();
  res.json({ events: events });
});

/*app.post("/sanitize", (req, res) => {
    const cleanedHtml = sanitizeHtml(req.body.data, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h2'])
    })
    res.json({html: cleanedHtml})
})*/

/*app.post("/edit-news-post", async (req, res) => {
    if (req.body.data._id) {
        let data = await News.findOne({_id: _id})
    } else {
        let data = new News({
            title: "",
            content: "",
            featureImage: "",
            otherImages: [],
            author: req.body.author,
            createdOn: new Date(),
            lastEdited: new Date()
        })
        data.save((err, data) => {
            if (err) return res.json({err: err, success: false})
            return res.json({success: true, data: data})
        })
        
    }
})*/

app.get("/api/resources/:filename", (req, res) => {
  res.sendFile(process.cwd() + "/resources/" + req.params.filename);
});

app.listen(port, () => console.log(`Server up and running on port ${port}!`));
