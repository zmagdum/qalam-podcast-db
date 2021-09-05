const firebase = require("firebase");
const fs = require('fs');
const { title } = require("process");
let Parser = require('rss-parser');
let rssParser = new Parser();
const { v5: uuidv5 } = require('uuid');
const MY_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
// Required for side-effects
require("firebase/firestore");

let overwriteEpisodes = false;

// Initialize Cloud Firestore through Firebase
firebase.initializeApp({
    apiKey: 'AIzaSyDQBFsRjLgZPOFe0ChSrzlMLL5NpC_iLF8',
    authDomain: 'qalam-b7168.firebaseapp.com',
    projectId: 'qalam-b7168'
  });
  
var db = firebase.firestore();
let rawdata = fs.readFileSync('categories.json');
let series = JSON.parse(rawdata);
let fileCategories = []
series.forEach(element => {
    element.updated = Date.now()
    fileCategories.push(element)
//    db.collection("categories").doc(element.title).set(element);
})

dumpEpisodeStats().then(function (epStats) {
    console.log("Episode stats", epStats);
});

let speakers = {}
JSON.parse(fs.readFileSync('scholors.json')).forEach(spkr => {
//    db.collection("scholors").doc(spkr.name).set(spkr);
    speakers[spkr.name] = spkr
});        

categories = []
db.collection("categories").get().then((querySnapshot) => {
    categories = []
    querySnapshot.forEach((doc) => {
        const cat = doc.data()
        categories.push(cat);
    });
    fileCategories.forEach(cat => {
        const ex = categories.find(element => element.title === cat.title);
        if (!ex || ((ex.artwork != cat.artwork || ex.speakers != cat.speakers || ex.feedUrl != cat.feedUrl))) {
            db.collection("categories").doc(cat.title).set(cat);
        } 
    })
    rssParser.parseURL("http://feeds.feedburner.com/QalamPodcast").then(feed => {
        console.log(feed.title, feed.items.length);
        const episodes = [], episodeIds = [];
        feed.items.forEach(item => {
            const [category, epTitle] = getCategory(item.title, categories)
            if ("Uncategorized" === category) {
                console.log("Could not determine category", item.title)
            }
            var episode = {
                title: item.title,
                shortTitle: epTitle,
                pubDate: Date.parse(item.pubDate),
                type: item.enclosure ? item.enclosure.type : 'podcast',
                content: item.content,
                contentSnippet: item.contentSnippet,
                isoDate: Date.parse(item.isoDate),
                subtitle: item.itunes && item.itunes.subtitle ? item.itunes.subtitle : 'bad-subtitle', 
                duration: parseDuration(item.itunes.duration),
                image: item.itunes && item.itunes.image ? item.itunes.image : 'bad-image',
                keywords: item.itunes && item.itunes.keywords ? item.itunes.keywords : 'bad-keywords',
                streamUrl: item.enclosure ? item.enclosure.url : 'nourl',
                category: category,
                speaker: getSpeaker(item.categories, speakers, category, categories),
                updated: Date.now(), 
            }
            episode.id = uuidv5(episode.streamUrl, MY_NAMESPACE);
            if (episode.speaker == "unknown") {
                getSpeaker(item.categories, speakers)
                console.log("no speaker", item, episode)
            }
            //console.log("Episode", episode.id, episode.category, episode.shortTitle, episode.speaker);
            episodes.push(episode)
            episodeIds.push(episode.id)
            //console.log(episode.title, episode.category)
    //        db.collection("episodes").doc(id).set(episode);12,674.10
        });
        db.collection("episodes", ref => ref.where(firebase.firestore.FieldPath.documentId(),'in', episodeIds)).get().then((querySnapshot) => {
            var ii = 0;
            exIds = []
            querySnapshot.forEach((doc) => {
                const ep = doc.data();
                exIds.push(doc.id)
                //console.log("Found Ids ", ep.title);
            });
            notSaved = episodes.filter(ep => !exIds.includes(ep.id));
            notSaved.forEach(episode => {
                id = episode.id 
                //episode.id = undefined
                db.collection("episodes").doc(id).set(episode);
            });
            updateCount = 0
            if (overwriteEpisodes) {
                existing = episodes.filter(ep => exIds.includes(ep.id));
                existing.forEach(episode => db.collection("episodes").doc(episode.id).set(episode));
                updateCount = existing.length
            }
            console.log("Added episodes", notSaved.length, "Updated episodes", updateCount);
        });
            
        fs.writeFileSync('episodes.json', JSON.stringify(episodes, null, 2));
    });
});
      
const getCategory = function(title, cateories) {
    for (cat of categories) {
        if (title.indexOf(cat.title) >= 0) {
            return [cat.title, shortTitle(title, cat.title)]
        }
        if (cat.tokens) {
            for (tok of cat.tokens) {
                if (title.indexOf(tok) >= 0) {
                    return [cat.title, shortTitle(title, tok)]
                }
            }
        }
  
    }
    toks = title.split("–")
    if (toks.length > 1) {
        return toks[0].trim()
    }
    toks = title.split(":")
    if (toks.length > 1) {
        return toks[0].trim()
    }
    toks = title.split("|")
    if (toks.length > 1) {
        return toks[0].trim()
    }
    return "Uncategorized"
}


const getSpeaker = function(categories, speakers, categoryName, cats) {
    if (categories) {
        for (c in categories) {
            if (speakers.hasOwnProperty(categories[c])) {
                return categories[c];
            }
        }
        for (const [key, spkr] of Object.entries(speakers)) { 
             for (const alias of spkr.aliases) {
                if (categories.includes(alias)) {
                    return key;
                }
            }
        }
    } 
    if (cats) {
        for (c of cats) {
            if (c.title == categoryName) {
                return c.speakers;
            }
        }
    }
    return "unknown";
}

function dumpEpisodeStats() {
    var epStats = {};
    return new Promise(function (resolve, reject) {
        db.collection("episodes").get().then((querySnapshot) => {
            var ii = 0;
            querySnapshot.forEach((doc) => {
                const ep = doc.data();
                if (!ep.category) {
                    console.log("Category not found for", ep.title);
                } else {
                    if (ep.category in epStats) {
                        epStats[ep.category] = epStats[ep.category] + 1;
                    } else {
                        epStats[ep.category] = 1;
                    }
                }
            });
            resolve(epStats);
        });
    });
}

async function readCategories() {
    const doc = await db.collection('categories').get();
   
    if (!doc.exists) {
     throw new Error('No such document!');
    }
    return doc.data();
}
   
const getSpeakerFromCategory = function(name, categories) {
    if (categories) {
        for (c of categories) {
            if (c.title == name) {
                return c.speakers;
            }
        }
    }
    return "unknown";
}

async function readCategories() {
    const doc = await db.collection('categories').get();
   
    if (!doc.exists) {
     throw new Error('No such document!');
    }
    return doc.data();
}
const parseDuration = function(str) {
    if (str === undefined) {
        return 3600;
    }
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
    if (short.charAt(0) == "–" || short.charAt(0) == ":" || short.charAt(0) == "|") {
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

