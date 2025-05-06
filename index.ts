import "dotenv/config";
import express from "express";
import session from "express-session";
import { url } from "inspector";
import { MongoClient, ObjectId } from "mongodb";
import { exit } from "process";
const MongoStore = require("connect-mongo");
const uri = process.env.urlMongo;
if (!uri) {
  console.log("uri not found!");
  exit(1);
}
const app = express();
const client = new MongoClient(uri);
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(express.json());
const jwtsecret = process.env.JWT_SECRET;
if (!jwtsecret) {
  console.log("JWT secret not found!");
  exit(1);
}
const secure = process.env.secure === "true";
app.use(
  session({
    secret: jwtsecret,
    store: MongoStore.create({ mongoUrl: uri }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: secure,
      maxAge: 604800000,
    },
  })
);
app.set("view engine", "ejs");
const port = process.env.port;
if (!port) {
  console.log("port not found!");
  exit(1);
}
app.set("port", parseInt(port));
declare module "express-session" {
  export interface SessionData {
    user: UserProfile;
  }
}

interface UserProfile {
  _id?: ObjectId;
  id: number;
  readonly username: string;
  readonly emailAddress: string;
  password: string;
  friendsList: number[];
  photoUrl: string;
  shortDescription: string;
  timeLine: Message[];
}
interface Message {
  messageId: number;
  senderId: number;
  content: string;
  timestamp: Date;
}

///
export interface RandomUsers {
  results: Result[];
  info: Info;
}

export interface Info {
  seed: string;
  results: number;
  page: number;
  version: string;
}

export interface Result {
  gender: string;
  name: Name;
  location: Location;
  email: string;
  login: Login;
  dob: Dob;
  registered: Dob;
  phone: string;
  cell: string;
  id: ID;
  picture: Picture;
  nat: string;
}

export interface Dob {
  date: Date;
  age: number;
}

export interface ID {
  name: string;
  value: string;
}

export interface Location {
  street: Street;
  city: string;
  state: string;
  country: string;
  postcode: string;
  coordinates: Coordinates;
  timezone: Timezone;
}

export interface Coordinates {
  latitude: string;
  longitude: string;
}

export interface Street {
  number: number;
  name: string;
}

export interface Timezone {
  offset: string;
  description: string;
}

export interface Login {
  uuid: string;
  username: string;
  password: string;
  salt: string;
  md5: string;
  sha1: string;
  sha256: string;
}

export interface Name {
  title: string;
  first: string;
  last: string;
}

export interface Picture {
  large: string;
  medium: string;
  thumbnail: string;
}

///

let userProfiles: UserProfile[] = [];
let allMessages: Message[] = [];
app.get("/", async (req, res) => {
  const user = req.session.user;
  if (user) {
    res.redirect(`/myProfile`);
  } else {
    res.render("login");
  }
});
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = userProfiles.find((user) => user.username === username);

  if (username && password) {
    if (user?.password === password) {
      req.session.user = user;
      req.session.save(() => res.redirect(`/myProfile`));
    }
  } else {
    res.sendStatus(500).render("ERROR");
  }
});

app.get("/logout", async (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});
app.get("/myProfile", async (req, res) => {
  const user = req.session.user;
  if (user) {
    const friends = user.friendsList
      .filter((friendId) => {
        const friend = userProfiles.find((user) => user.id === friendId);
        return friend && friend.friendsList.includes(user.id);
      })
      .map((friendId) => {
        return userProfiles.find((user) => user.id === friendId);
      });
    userProfiles = await client
      .db("project")
      .collection("userProfiles")
      .find<UserProfile>({})
      .toArray();
    res.render(`myProfile`, {
      userProfiles,
      user,
      friends,
    });
  } else {
    res.render("ERROR");
  }
});
app.post("/updateProfile", async (req, res) => {
  const user = req.session.user;
  if (user) {
    const newPhotoUrl = req.body.photoUrl;
    const newShortDescription = req.body.shortDescription;

    const result = await client
      .db("project")
      .collection("userProfiles")
      .updateOne(
        { id: user.id },
        {
          $set: {
            photoUrl: newPhotoUrl,
            shortDescription: newShortDescription,
          },
        }
      );

    if (result.modifiedCount === 1) {
      req.session.user = {
        ...user,
        photoUrl: newPhotoUrl,
        shortDescription: newShortDescription,
      };
      const index = userProfiles.findIndex((profile) => profile.id === user.id);

      userProfiles[index] = {
        ...userProfiles[index],
        photoUrl: newPhotoUrl,
        shortDescription: newShortDescription,
      };
      res.redirect(`/myProfile`);
    } else {
      res.redirect(`/myProfile`);
    }
  } else {
    res.render("ERROR");
  }
});
app.get("/profiles", async (req, res) => {
  const user = req.session.user;
  if (user) {
    const friends = user.friendsList
      .filter((friendId) => {
        const friend = userProfiles.find((user) => user.id === friendId);
        return friend && friend.friendsList.includes(user.id);
      })
      .map((friendId) => {
        return userProfiles.find((user) => user.id === friendId);
      });
    const notFriends = userProfiles.filter(
      (otherUser) =>
        !user.friendsList.includes(otherUser.id) && otherUser.id !== user.id
    );
    userProfiles = await client
      .db("project")
      .collection("userProfiles")
      .find<UserProfile>({})
      .toArray();
    res.render("profiles", {
      user,
      userProfiles,
      friends,
      notFriends,
    });
  } else {
    res.render("ERROR");
  }
});

app.get("/myTimeline", async (req, res) => {
  const user = req.session.user;
  if (user) {
    const timelineUser = await client
      .db("project")
      .collection("userProfiles")
      .findOne({ id: user?.id });

    const allMessages = await client
      .db("project")
      .collection("allMessages")
      .find({ senderId: user?.id })
      .toArray();

    if (user) {
      res.render("myTimeline", {
        user,
        allMessages,
      });
    } else {
      res.render("ERROR");
    }
  } else {
    res.render("ERROR");
  }
});

app.post("/myTimeline/addMessage", async (req, res) => {
  const user = req.session.user;
  const messageContent = req.body.messageContent;
  if (user) {
    const result = await client
      .db("project")
      .collection("allMessages")
      .insertOne({
        senderId: user?.id,
        content: messageContent,
        timestamp: new Date(),
      });

    res.redirect(`/myTimeline`);
  } else {
    res.render("ERROR");
  }
});

app.post("/profiles/adduser/:friendid", async (req, res) => {
  const user = req.session.user;
  const friendId = parseInt(req.params.friendid);

  if (user?.id === friendId) {
    res.status(400).send("Cannot add yourself as a friend");
    return;
  }
  const friend = userProfiles.find((user) => user.id === friendId);

  if (user && friend) {
    if (!user.friendsList.includes(friendId)) {
      user.friendsList.push(friendId);
      await client
        .db("project")
        .collection("userProfiles")
        .updateOne(
          { id: user.id },
          { $set: { friendsList: user.friendsList } }
        );
    }
    const friends = user.friendsList
      .filter((friendId) => {
        const friend = userProfiles.find((user) => user.id === friendId);
        return friend && friend.friendsList.includes(user.id);
      })
      .map((friendId) => {
        return userProfiles.find((user) => user.id === friendId);
      });
    const notFriends = userProfiles.filter(
      (otherUser) =>
        !user.friendsList.includes(otherUser.id) && otherUser.id !== user.id
    );
    userProfiles = await client
      .db("project")
      .collection("userProfiles")
      .find<UserProfile>({})
      .toArray();
    res.render("profiles", {
      user,
      userProfiles,
      friends,
      notFriends,
    });
  } else {
    res.render("ERROR");
  }
});
app.get("/timeline", async (req, res) => {
  const user = req.session.user;
  const timelineUser = await client
    .db("project")
    .collection("userProfiles")
    .findOne({ id: user?.id });

  if (!user) {
    res.render("ERROR");
  }
  const allMessages = await client
    .db("project")
    .collection("allMessages")
    .find()
    .toArray();

  const senderProfiles = await client
    .db("project")
    .collection("userProfiles")
    .find({ id: { $in: allMessages.map((message) => message.senderId) } })
    .toArray();

  const senderProfilesMap = new Map(
    senderProfiles.map((profile) => [profile.id, profile])
  );
  const messagesWithSenderInfo = allMessages.map((message) => ({
    ...message,
    senderInfo: senderProfilesMap.get(message.senderId),
  }));

  res.render("timeline", { messagesWithSenderInfo, user });
});

app.post("/createProfile", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const email = req.body.email;
  const highestIdUser = await client
    .db("project")
    .collection("userProfiles")
    .findOne({}, { sort: { id: -1 } });
  let nextId;
  if (highestIdUser) {
    nextId = highestIdUser.id + 1;
  } else {
    nextId = -1;
  }
  if (nextId == -1) {
    res.status(400).send("Cannot add YOU SERVER ID ISSUE ERROR");
  } else {
    const user: UserProfile = {
      id: nextId,
      username: `${username}`,
      friendsList: [],
      emailAddress: email,
      password: password,
      photoUrl: ``,
      shortDescription: ``,
      timeLine: [],
    };
    userProfiles.push(user);
    const newUserForDatabase = await client
      .db("project")
      .collection("userProfiles")
      .insertOne(user);
    req.session.user = user;
    res.redirect("/myProfile");
  }
});
app.listen(app.get("port"), async () => {
  await client.connect();
  userProfiles = await client
    .db("project")
    .collection("userProfiles")
    .find<UserProfile>({})
    .toArray();
  allMessages = await client
    .db("project")
    .collection("allMessages")
    .find<Message>({})
    .toArray();

  async function generateRandomUsers() {
    const response = await fetch("https://randomuser.me/api/?results=10");
    const data = await response.json();
    return data.results;
  }

  if (userProfiles.length === 0) {
    const randomUsers = await generateRandomUsers();

    const formattedUsers = randomUsers.map(
      (randomUser: Result, index: number) => {
        return {
          id: index + 1,
          username: `${randomUser.login.username}`,
          friendsList: [],
          emailAddress: randomUser.email,
          password: randomUser.login.password,
          photoUrl: randomUser.picture.large,
          shortDescription: `${randomUser.name.first} ${randomUser.name.last}`,
          timeLine: [],
        };
      }
    );

    const insertionResults = await client
      .db("project")
      .collection("userProfiles")
      .insertMany(formattedUsers);

    userProfiles.push(...formattedUsers);
  }
  allMessages.sort((a, b) => a.messageId - b.messageId);
});
