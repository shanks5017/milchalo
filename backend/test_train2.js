import { fetchNtes, trainDataUrl } from './services/train/ntesClient.js';
import getTrainsRouter from './routes/train/getTrains.js';
import express from 'express';
import supertest from 'supertest';

async function run() {
    console.log("Testing NTES Client...");
    try {
        const url = trainDataUrl("12678", "25-07-2026");
        const res = await fetchNtes(url);
        console.log("NTES Data fetched successfully. Train:", res.trainNo, res.trainName);
    } catch (e) {
        console.error("NTES Error:", e.message);
    }

    console.log("\nTesting getTrains.js...");
    try {
        const app = express();
        app.use(getTrainsRouter);
        const req = await supertest(app).get('/getTrainOn?from=CBE&to=SBC&date=25-07-2026');
        console.log("getTrainOn response status:", req.status);
        console.log("Trains found:", req.body?.data?.length ?? 0);
    } catch (e) {
        console.error("getTrains Error:", e.message);
    }
}
run();
