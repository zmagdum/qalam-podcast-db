const firebase = require("firebase");
const fs = require('fs');
const { title } = require("process");
let Parser = require('rss-parser');
let rssParser = new Parser();
const { v5: uuidv5 } = require('uuid');
const MY_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
// Required for side-effects
require("firebase/firestore");

// Initialize Cloud Firestore through Firebase
firebase.initializeApp({
    apiKey: 'AIzaSyDQBFsRjLgZPOFe0ChSrzlMLL5NpC_iLF8',
    authDomain: 'qalam-b7168.firebaseapp.com',
    projectId: 'qalam-b7168'
  });
  
var db = firebase.firestore();

let rawdata = fs.readFileSync('categories.json');
let series = JSON.parse(rawdata);

series.forEach(element => {
    element.updated = Date.now()
    db.collection("catagories").doc(element.title).set(element);
    console.log('added/updated category' + element.title);

    if (element.feedUrl && element.artwork == '40hadith') {
        rssParser.parseURL(element.feedUrl).then(feed => {
            console.log(feed.title);
            feed.items.forEach(item => {
                var episode = {
                    title: item.title,
                    shortTitle: shortTitle(item.title, element.title),
                    pubDate: Date.parse(item.pubDate),
                    type: item.enclosure ? item.enclosure.type : 'podcast',
                    content: item.content,
                    contentSnippet: item.contentSnippet,
                    isoDate: Date.parse(item.isoDate),
                    subtitle: item.itunes.subtitle, 
                    duration: parseDuration(item.itunes.duration),
                    image: item.itunes.image,
                    keywords: item.itunes.keywords,
                    streamUrl: item.enclosure ? item.enclosure.url : 'nourl',
                    category: element.title,
                    updated: Date.now(), 
                }
                id = uuidv5(item.enclosure.url, MY_NAMESPACE);
                db.collection("episodes").doc(id).set(episode);
            });
        });
    }

}); 

const parseDuration = function(str) {
    const tokens = str.split(':');
    duration = 0;
    if (tokens.length > 2) {
        duration += parseInt(tokens[2]) * 3600;
    }
    if (tokens.length > 1) {
        duration += parseInt(tokens[2]) * 60;
    }
    if (tokens.length > 0) {
        duration += parseInt(tokens[1]);
    }
    if (duration == 0) {
        duration = 3600;
    }
    return duration;
}

const shortTitle = function(title, category) {
    let short = title.replace(category, '').trim()
    if (short.charAt(0) == '-' || short.charAt(0) == ':') {
        short = short.substring(1).trim()
    }
    return short;
}
// db.collection("users").add({
//     first: "Ada",
//     last: "Lovelace",
//     born: 1815
// })
// .then((docRef) => {
//     console.log("Document written with ID: ", docRef.id);
// })
// .catch((error) => {
//     console.error("Error adding document: ", error);
// });

