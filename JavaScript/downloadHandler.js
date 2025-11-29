// Handles download buttons
document.addEventListener('DOMContentLoaded', () => {
  const downloadLex=document.getElementById('downloadLex');
  const downloadForward=document.getElementById('downloadForward');
  const downloadInverted=document.getElementById('downloadInverted');

  function downloadJSON(filename,data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    link.download=filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if(downloadLex){
    downloadLex.addEventListener('click', ()=> {
      if(!window.lexicon || Object.keys(window.lexicon).length===0) return alert('No lexicon generated yet. Upload a file first.');
      downloadJSON('lexicon.json',window.lexicon);
    });
  }
  if(downloadForward){
    downloadForward.addEventListener('click', ()=> {
      if(!window.forwardIndex || window.forwardIndex.length===0) return alert('No forward index yet. Upload a file first.');
      downloadJSON('forwardIndex.json',window.forwardIndex);
    });
  }
  if(downloadInverted){
    downloadInverted.addEventListener('click', ()=> {
      if(!window.invertedIndex || Object.keys(window.invertedIndex).length===0) return alert('No inverted index yet. Upload a file first.');
      downloadJSON('invertedIndex.json',window.invertedIndex);
    });
  }
});
