# Steam Search Engine (DSA Project)

This is our small search engine project based on Steam game data.  
We kept it simple, clean, and easy to understand. The whole thing runs in the browser, no backend needed.

We take CSV or JSON files, clean the text, tokenize everything, and then build three structures:

- Lexicon  
- Forward Index  
- Inverted Index  

After indexing, you can download all three as JSON files.

---

## How It Works

The flow is straight:

1. User uploads dataset files  
2. We clean the text  
3. Split everything into words  
4. Remove stopwords  
5. Build forward index  
6. Build lexicon  
7. Build inverted index  
8. Let the user download all results  

Everything happens inside the browser using JavaScript.

---

## Features

- Upload multiple files  
- Handles CSV and JSON  
- Clean tokenization  
- Stopword filtering  
- Forward index for all documents  
- Inverted index for fast searching  
- Lexicon that stores all unique terms  
- Download everything as JSON  
- Simple UI inspired by Steam  
- No server. Pure frontend.

---

## Tech Used

- HTML  
- CSS  
- JavaScript  
- FileReader API  
- Blob API for downloads  

---

## Project Structure

