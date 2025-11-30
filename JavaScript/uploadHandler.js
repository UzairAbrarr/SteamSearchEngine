//wait untill the document is fully loaded
document.addEventListener('DOMContentLoaded', () => 
{
    /*We grab the file input, button, and
     info display area so you can work with them later*/
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadDatasetBtn');
  const uploadInfo = document.getElementById('upload-info');

  /*We are making it window because we want to access these globally for downloading later.
    forwardIndex: Stores the final processed documents. Basically: list of all games with their info.
    invertedIndex: Maps each keyword to the list of game IDs that contain that keyword.
    lexicon: Just stores words you have seen. A dictionary of all unique terms.*/
  window.forwardIndex = [];
  window.invertedIndex = {};
  window.lexicon = {};

  /*Some words like “the”, “and”, “a” are useless in search, so we ignore them. A Set is perfect 
  because checking if a word exists in it is very fast.
  A Set is like a list but smarter. It doesn’t allow duplicates and 
  checking if something exists inside it is super fast.*/
  const STOP_WORDS = new Set(["a","an","the","and","or","but","is","of","in","to","for","with","on","at","by","from","up","down","out","about","into","as","then","now","it","its","are","was","were","be","been","that","this","must","can","will","i","my"]);

    /*Normal .split(",") just cuts everything at commas.
    But CSV files sometimes have commas inside quotes, like:
    "Call of Duty, Modern Warfare", Action, Shooter, FPS
    If we split normally, it breaks the game name in half and ruins the data.

    So this regex is basically saying:
    Split at commas, but only the commas that are not inside quotes.*/
  function simpleCSVSplit(line){
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  }

  /*Combine name + shortDescription into one string.

    .toLowerCase() so searches are case-insensitive.
    .replace(/[^\w\s]/g,' ') removes punctuation (anything not a letter/number/underscore/space), turning punctuation into spaces so splitting is clean.
    .split(/\s+/) splits on any whitespace into words.
    .filter(...) removes empty strings and stop words.

    For each remaining word:
    add it to lexicon (we mark it true so we know it exists).
    if the word is not yet in invertedIndex, create an empty array for it.
    push the doc id (doc.appid) into that array.
    This builds the inverted index: word → list of doc ids.*/
  function indexDoc(doc){
    const combined = ((doc.name||'')+' '+(doc.shortDescription||'')).toLowerCase().replace(/[^\w\s]/g,' ');
    const words = combined.split(/\s+/).filter(w => w && !STOP_WORDS.has(w));
    for(const w of words){
      window.lexicon[w]=true;
      if(!window.invertedIndex[w]) window.invertedIndex[w]=[];
      window.invertedIndex[w].push(doc.appid||String(window.forwardIndex.length-1));
    }
  }

  /*If no files were selected, show a message and stop.*/
  async function processFiles(files){
    if(!files || files.length===0) return uploadInfo.textContent='No file selected';

    //Tell user we started.
    uploadInfo.textContent='Processing...';

    //Reset all indexes before processing new files.
    window.forwardIndex.length=0;
    window.invertedIndex={};
    window.lexicon={};

    //We will count how many rows we processed.
    let totalCount=0;

    /*Convert each file into text.
    If reading fails, skip the file.*/
    for(let f of Array.from(files)){
      let text;
      try{text=await f.text();}catch(e){console.error(e);continue;}

      //Split into lines and remove empty lines.
      const rows=text.split('\n').filter(l=>l.trim());

      //If file has no data rows, skip.
      if(rows.length<2) continue;

      /*Split the first line (header).
        Lowercase it so matching column names is easy.*/
      const headers=simpleCSVSplit(rows[0].toLowerCase());

      /*Find where each column is located in the CSV.
        Some datasets change order, so we find indexes dynamically.*/
      const colMap={
        appid: headers.indexOf('appid'),
        name: headers.indexOf('name'),
        short_description: headers.indexOf('short_description'),
        header_image: headers.indexOf('header_image'),
        metacritic_score: headers.indexOf('metacritic_score'),
        recommendations_total: headers.indexOf('recommendations_total'),
        is_free: headers.indexOf('is_free')
      };
      /*Split the row into columns.
        If row is empty, skip.*/
      for(let i=1;i<rows.length;i++){
        const parts=simpleCSVSplit(rows[i]);
        if(!parts || parts.length===0) continue;

        /*We extract values from the correct columns.
        Clean them up. Parse numbers.
        Convert is_free string to true or false.*/
        const doc={
          appid:(parts[colMap.appid]||'').trim(),
          name:(parts[colMap.name]||'').trim(),
          shortDescription:(parts[colMap.short_description]||'').trim(),
          headerImage:(parts[colMap.header_image]||'').trim(),
          metacriticScore:parseInt(parts[colMap.metacritic_score]||0,10)||0,
          recommendationsTotal:parseInt(parts[colMap.recommendations_total]||0,10)||0,
          isFree:((parts[colMap.is_free]||'').trim().toLowerCase()==='true')
        };

        //Store the full document in forward index.
        window.forwardIndex.push(doc);

        //Send doc to our indexing function to update inverted index and lexicon.
        indexDoc(doc);

        //Count processed rows.
        totalCount++;
      }
    }
    
    //Update UI to tell user we are finished.
    uploadInfo.textContent=`Done! Total ${totalCount} records processed. You can download JSON files now.`;
  }

  fileInput.addEventListener('change', (e)=>{
    const files=e.target.files;
    uploadInfo.textContent=(files.length===1)?`Selected: ${files[0].name}`:`Selected ${files.length} files`;
  });

  uploadBtn.addEventListener('click', ()=>processFiles(fileInput.files));
});
