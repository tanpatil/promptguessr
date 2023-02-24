// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import type { SubmitResponse, Error } from './types';
import { Configuration, OpenAIApi } from 'openai';
import { initializeApp } from 'firebase/app';
import { getDoc, getFirestore, doc } from 'firebase/firestore';

// Initialize Firebase and Firestore
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: 'prompt-guessr.firebaseapp.com',
    projectId: 'prompt-guessr',
    storageBucket: 'prompt-guessr.appspot.com',
    messagingSenderId: process.env.FIREBASE_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize OpenAI API
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Get similarity score between prompt and guess
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SubmitResponse | Error>
) {
    // TODO: possible store existing embeddings in firebase
    try {
        const { pid } = req.query;
        const { guess } = req.body;

        if (!pid) {
            res.status(400).json({ message: 'No prompt id provided' });
            return;
        }

        if (!guess) {
            res.status(400).json({ message: 'No guess provided' });
            return;
        }

        const prompt = await getDoc(doc(db, 'prompts', pid as string));
        if (prompt.exists()) {
            // Call OpenAI API to get similarity score
            const guessEmbedding = await openai.createEmbedding({
                model: 'text-embedding-ada-002',
                input: guess,
            });
            const guessVector = guessEmbedding.data.data[0].embedding;

            const promptEmbedding = await openai.createEmbedding({
                model: 'text-embedding-ada-002',
                input: prompt.data().prompt,
            });
            const promptVector = promptEmbedding.data.data[0].embedding;

            const similarity = calculateCosineSimilarity(
                guessVector,
                promptVector
            );

            res.send({
                pid: pid as string,
                prompt: prompt.data().prompt,
                similarity,
            });
        } else {
            res.status(404).json({ message: `Prompt ${pid} not found` });
        }
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

function calculateCosineSimilarity(vectorA: number[], vectorB: number[]) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i] * vectorB[i];
        magnitudeA += vectorA[i] * vectorA[i];
        magnitudeB += vectorB[i] * vectorB[i];
    }

    return dotProduct / Math.sqrt(magnitudeA * magnitudeB);
}
