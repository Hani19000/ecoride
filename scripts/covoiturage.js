const prix = document.getElementById("max-price");
const durée = document.getElementById("max-duration");
const note = document.getElementById("rating");
const trie = document.getElementById("sort");

function clearDisplay() {
    prix.value = '';
    durée.value = '';
    note.value = '';
    trie.value = '';
}