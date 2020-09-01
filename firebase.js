const admin = require("firebase-admin");

const serviceAccount = require("./firebase-service-account.json");

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bcschool2-4487c.firebaseio.com"
});

module.exports = {
  firestore: admin.firestore(app)
}