const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { NlpManager } = require("node-nlp");
const { firestore } = require("./firebase");

app.use(bodyParser.json());

function checkDataProps(data) {
  const { intent, utterances, answers } = data;
  if (!intent) {
    throw new Error("Missing 'intent' prop");
  }
  if (!utterances) {
    throw new Error("Missing 'utterances' prop");
  }
  if (!answers) {
    throw new Error("Missing 'answers' prop");
  }
  if (!Array.isArray(utterances)) {
    throw new Error("Property 'utterances' should be an array");
  }
  if (!Array.isArray(answers)) {
    throw new Error("Property 'answers' should be an array");
  }
  if (answers.length === 0) {
    throw new Error("There should be at least one answer");
  }
  if (utterances.length === 0) {
    throw new Error("There should be at least one utterance");
  }
  return { intent, utterances, answers };
}

async function getTrainingData() {
  const snapshot = await firestore.collection("trainingData").get();
  const trainingData = [];
  snapshot.docs.forEach((doc) => {
    const documentData = doc.data();
    documentData.id = doc.id;
    trainingData.push(documentData);
  });
  return trainingData;
}

app.get("/training-data", async (req, res) => {
  try {
    const trainingData = await getTrainingData();
    res.status(200).send(trainingData);
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/training-data/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const document = await firestore.collection("trainingData").doc(id).get();
    if (document.exists) {
      res.status(200).send(document.data());
    } else {
      res.status(404).send();
    }
  } catch (e) {
    res.status(500).send("Internal Error, Sorry");
  }
});

app.delete("/training-data/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await firestore.collection("trainingData").doc(id).delete();
    res.status(204).send();
  } catch (e) {
    res.status(500).send("Internal Error, Sorry");
  }
});

app.post("/training-data", async (req, res) => {
  let data;
  try {
    data = checkDataProps(req.body);
  } catch (error) {
    res.status(422).send({ error: error.message });
    return;
  }

  try {
    const document = await firestore.collection("trainingData").add(data);
    res.status(201).send({ id: document.id });
  } catch (e) {
    res.status(500).send("Internal Error, Sorry");
  }
});

app.put("/training-data/:id", async (req, res) => {
  let data;
  try {
    data = checkDataProps(req.body);
  } catch (error) {
    res.status(422).send({ error: error.message });
    return;
  }

  try {
    const docId = req.params.id;
    await firestore
      .collection("trainingData")
      .doc(docId)
      .set(data, { merge: true });
    res.status(204).send();
  } catch (e) {
    res.status(500).send("Internal Error, Sorry");
  }
});

app.post("/message", async (req, res) => {
  let { message } = req.body;

  const manager = new NlpManager({ languages: ["en"], forceNER: true });
  console.log(`Getting training data`);
  const trainingData = await getTrainingData();

  trainingData.forEach((intentData) => {
    intentData.utterances.forEach((utterance) => {
      manager.addDocument("en", utterance, intentData.intent);
    });
    intentData.answers.forEach((answer) => {
      manager.addAnswer("en", intentData.intent, answer);
    });
  });

  console.log(`Training`);
  await manager.train();

  try {
    console.log(`Done training`);
    const response = await manager.process("en", message);
    res.status(200).send({ response: response });
  } catch (e) {
    res.status(500).send("Internal Error, Sorry");
  }
});

app.listen(4000, () => {
  console.log(`Started server! Listening on 4000`);
});
