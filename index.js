const timer = document.getElementById("timer");
const timerSecondary = document.getElementById("timer-secondary");
const execRow = document.getElementById("exec-row");
const memoRow = document.getElementById("total-memo-row");
const totalRow = document.getElementById("total-row");
const buttonArea = document.getElementById("button-area");
const pastAttempts = document.getElementById("past-attempts");
const dialog = document.getElementById("summary-dialog");
const editDialog = document.getElementById("edit-dialog");

const hour = 360_000;

let timerState = "ready";
let time = 0;
let realTimeStorage = 0;
let realExecTimeStorage = 0;
let bell = document.querySelector("audio");
let endedAtHour = false;
let editorMode;

let editing = false;
function toggleInputTo(boolean) {
    editing = boolean;
    let inputs = document.querySelectorAll(".row input");
    for(let i = 0; i < inputs.length; i++) {
        inputs[i].disabled = !boolean;
    }
}

let splitTime = 0;
let currentSplit = 0;
let splitsTotal = 2;
let totalCubes = 0;
let attemptEndTime = 0;
let plusTwos = 0;

let reviewSystemStorage = JSON.parse(localStorage.getItem("save"));

let attempts;
let attemptIndex;

let masterSave;

function loadAttempts() {
    attempts = JSON.parse(localStorage.getItem("attempts"));
    if (attempts === null) {
        attempts = [];
    }
}

loadAttempts()
attempts = [];

let rows = [document.querySelector(".row")];
document.querySelector("#hour-sound-option").addEventListener("input", (_event) => {
    preferences.bell = !preferences.bell;
    localStorage.setItem("preferences", JSON.stringify(preferences));
});
if(Object.keys(reviewSystemStorage) !== 0) {
    document.addEventListener("keyup", (event) => {inputUp(event)} );
    document.querySelector(".type").addEventListener("click", (event) => {changeType(event)});
    document.querySelector("[name=default-cubes-input]").addEventListener("input", (_event) => {updateDefaultCubes()});
}

class Attempt {
    constructor(solved, attempted, time, summary, notes, date, reviewSystem, plusTwos) {
        attempted = parseInt(attempted);
        solved = parseInt(solved);
        plusTwos = parseInt(plusTwos);

        if (solved > attempted) {
            this.solved = attempted;
        } else if (solved < 0) {
            this.solved = 0;
        } else {
            this.solved = solved;
        }

        this.attempted = attempted;
        this.time = time;
        this.summary = summary;
        this.notes = notes;
        this.date = date;
        this.reviewSystem = reviewSystem;
        this.plusTwos = plusTwos;
    }

    points() {
        if ((this.solved === 1 && this.attempted === 2) || this.solved < this.attempted/2) {
            return "DNF";
        } else {
            return (2*this.solved - this.attempted).toString();
        }
    }
}

class PastAttemptRow extends HTMLDivElement {
    constructor(attempt) {
        super();
        this.attempt = attempt;
        this.classList.add("past-attempt-row");
        this.classList.add("grey");

        let optionalP;
        if (this.attempt.points() === "DNF") {
            optionalP = ") ";
        } else {
            optionalP = "p) "
        }
        this.text = this.attempt.solved + "/" + this.attempt.attempted + " " + this.attempt.time + " (" + this.attempt.points() + optionalP + formatDate(this.attempt.date);

        let header = document.createElement("h3");
        header.textContent = this.text;
        this.appendChild(header);

        let iconsDiv = document.createElement("div");
        this.appendChild(iconsDiv);
        iconsDiv.classList.add("icons-div");

        let summaryIcon = document.createElement("img");
        summaryIcon.src = "assets/summary_icon.svg";
        summaryIcon.onclick = function() {
            displayDialog("Summary", attempt.summary);
        };
        iconsDiv.appendChild(summaryIcon);

        let editIcon = document.createElement("img");
        editIcon.src = "assets/edit_icon.svg";
        editIcon.onclick = function() {
            editing = true;
            attemptIndex = attempts.indexOf(this.closest(".past-attempt-row").attempt);
            displayEditDialog(attempt.notes, attempt.solved, attempt.attempted);
        };
        iconsDiv.appendChild(editIcon);

        let xButton = document.createElement("img");
        xButton.src = "assets/exit_icon.svg";
        iconsDiv.appendChild(xButton);
        xButton.addEventListener("click", (event) => {deletePastAttempt(event)});

        pastAttempts.appendChild(this);
    }
}

customElements.define("past-attempt-row", PastAttemptRow, {extends:"div"});

let radioButtons = document.querySelectorAll("input[type=radio]");
for (let i=0; i < radioButtons.length; i++) {
    if (radioButtons[i].name === "timer-option") {
        radioButtons[i].addEventListener("input", (event) => {changeTimerMode(event)});
    } else if (radioButtons[i].name === "timer-precision") {
        radioButtons[i].addEventListener("input", (event) => {changeTimerPrecision(event)});
    }
}

class Preferences {
    constructor(defaultCubes, bell, timerDisplay, timerPrecision) {
        this.defaultCubes = defaultCubes;
        this.bell = bell;
        this.timerDisplay = timerDisplay;
        this.timerPrecision = timerPrecision;
    }
}

let preferences;
loadPreferences();

document.querySelector(".cube-input").value = preferences.defaultCubes;
document.querySelector(".cube-input").addEventListener("input", (event) => {updateCubeNumber()});

function loadPreferences() {
    preferences = JSON.parse(localStorage.getItem("preferences"));

    if (preferences === null) {
        preferences = new Preferences(8, false, "global", "hundredth");
    }

    document.querySelector("[name=default-cubes-input]").value = preferences.defaultCubes;
    document.querySelector("input[type=checkbox]").checked = preferences.bell;

    for (let i=0; i<radioButtons.length; i++) {
        if (radioButtons[i].value === preferences.timerDisplay || radioButtons[i].value === preferences.timerPrecision) {
            radioButtons[i].checked = true;
        } else {
            radioButtons[i].checked = false;
        }
    }

    if (preferences.timerDisplay === "both") {
        timerSecondary.style.display = "block";
    }
}

updateCubeNumber();
loadTable(true);
displayAttempts();
toggleInputTo(false);
editDialog.close();

function loadTable(initial) {
    let lastLoaded = localStorage.getItem("lastLoaded");
    reviewSystemStorage = JSON.parse(localStorage.getItem("save"));
    setPlaceholdersTo("");

    if (lastLoaded === "null") {
        document.querySelector(".spreadsheet-div").style.visibility = "hidden";
        document.getElementById("review-system-name-header").textContent = "";
        document.getElementById("edit-button").style.display = "none";
        toggleReviewSystemAlert(true);
    } else if (!localStorage.getItem("lastLoadedName") in reviewSystemStorage) {
        document.querySelector(".spreadsheet-div").style.visibility = "hidden";
        document.getElementById("review-system-name-header").textContent = "";
        document.getElementById("edit-button").style.display = "none";
        toggleReviewSystemAlert(true);
    } else {
        document.querySelector(".spreadsheet-div").style.visibility = "visible";
        document.getElementById("review-system-name-header").textContent = localStorage.getItem("lastLoadedName");
        if (initial) {
            loadReviewSystem(null, false);
        }
    }
}

function clearRows(rows) {
    for (let i = 0; i < rows.length; i++) {
        rows[i].querySelector(".split-time").textContent = "";
        rows[i].querySelector(".global-time").textContent = "";
        rows[i].querySelector(".per-cube").textContent = "";
    }
}

function resetTimer() {
    clearInterval(interval);
    timerState = "ready";
    time = 0;
    splitTime = 0;
    currentSplit = 0;
    plusTwos = 0;
    endedAtHour = false;
    timer.textContent = "0.00";
    timerSecondary.textContent = "0.00";
    document.getElementById("reset-area").style.display = "none";

    clearRows(rows);
    clearRows([execRow, memoRow, totalRow]);

    buttonArea.style.display = "flex";
    pastAttempts.style.display = "flex";
    if (preferences.timerDisplay === "both") {
        timerSecondary.style.display = "block";
    }
}

function createSummary(notes) {
    let asterisk;
    let asteriskExplanation;
    let notesFormatted;

    if (endedAtHour) {
        asterisk = " *";
        asteriskExplanation = "\n\n* - attempted stopped at the hour, not all cubes executed";
    } else {
        asterisk = "";
        asteriskExplanation = "";
    }

    if (notes === "") {
        notesFormatted = "";
    } else {
        notesFormatted = `\n\nNotes: ${notes}`;
    }

    let slicedTime = attemptEndTime.toString().slice(0, 21);

    let clipboardText = `${document.getElementById("accuracy-input").value}/${totalCubes} MBLD attempt in ${formatTime(time)+"+".repeat(plusTwos)}[${document.querySelector("#total-memo-row .global-time").textContent}]\nended at ${slicedTime}\n`;
    for (i=0; i<rows.length; i++) {
        clipboardText += `\n${rows[i].querySelector(".split-name input").value} - ${rows[i].querySelector(".split-time").textContent} (${rows[i].querySelector(".global-time").textContent})`;
    }
    clipboardText += `\n\nMemo: ${document.querySelector("#total-memo-row .global-time").textContent}, ${document.querySelector("#total-memo-row .per-cube").textContent} per cube`;
    clipboardText += `\nExec: ${document.querySelector("#exec-row .split-time").textContent}, ${document.querySelector("#exec-row .per-cube").textContent} per cube${asterisk}`
    clipboardText += `\nTotal: ${document.querySelector("#total-row .global-time").textContent}, ${document.querySelector("#total-row .per-cube").textContent} per cube`;
    clipboardText += notesFormatted;
    clipboardText += `\n\nGenerated by MBLD Timer${asteriskExplanation}`;
    return clipboardText;
}

function inputUp(event) {
    if (event.key === " " && !editing && Object.keys(reviewSystemStorage).length !== 0) {
        switch (timerState) {
            case "ready":
                startTimer();
                break;
            case "running":
                if (currentSplit === splitsTotal) {
                    performSplit(true);
                    stopTimer();
                } else {
                    performSplit(false);
                }
                break;
        }
    } else if (event.key === "Backspace" && currentSplit !== 1 && timerState === "running") {
        performUnsplit();

    } else if (event.key === "Escape" && timerState !== "ready") {
        resetTimer();
    } else if (event.key === "Enter" && timerState === "done" && !editing) {
        let notesInput = document.getElementById("notes-input");
        validateAccuracyInput(document.getElementById("accuracy-input"));

        let attempt = new Attempt(document.getElementById("accuracy-input").value, totalCubes.toString(), (formatTime(time) + "+".repeat(plusTwos)), createSummary(notesInput.value), notesInput.value, Date.parse(attemptEndTime), localStorage.getItem("lastLoadedName"), plusTwos);
        attempts.unshift(attempt);
        localStorage.setItem("attempts", JSON.stringify(attempts));
        resetTimer();
        displayAttempts();
        notesInput.value = "";
    } else if (event.key === "2" && !event.altKey && plusTwos < 10 && timerState === "done") {
        plusTwos++
        time += 200;
        timer.textContent = formatTime(time) + "+".repeat(plusTwos);
    } else if (event.key === "2" && event.altKey && plusTwos != 0 && timerState === "done") {
        plusTwos--
        time -= 200;
        timer.textContent = formatTime(time) + "+".repeat(plusTwos);
    } else if (event.key === "h" && event.altKey && time >= hour && unformatTime(memoRow.querySelector(".global-time").textContent) < hour) {
        endedAtHour = !endedAtHour;

        switch (unformatTime(timer.textContent)) {
            case hour:
                time = realTimeStorage;
                execRow.querySelector(".split-time").textContent = formatTime(realExecTimeStorage);
                execRow.querySelector(".global-time").textContent = formatTime(time);
                execRow.querySelector(".per-cube").textContent = formatTime(Math.round(unformatTime(execRow.querySelector(".split-time").textContent)/totalCubes));
                timer.textContent = formatTime(time);
                plusTwos = 0;
                break;
            default:
                time = hour;
                execRow.querySelector(".split-time").textContent = formatTime(hour - unformatTime(memoRow.querySelector(".global-time").textContent));
                execRow.querySelector(".global-time").textContent = "1:00:00.00";
                execRow.querySelector(".per-cube").textContent = formatTime(Math.round(unformatTime(execRow.querySelector(".split-time").textContent)/totalCubes));
                timer.textContent = formatTime(time);
                plusTwos = 0;
                break;
        }
    }
}

function displayTime(final) {
    columns = document.querySelectorAll(".split-time");
    for (i = 0; i < columns.length; i++) {
        if (columns[i].textContent === "" && !columns[i].classList.contains("special")) {
            columns[i].textContent = formatTime(splitTime);
            columns[i].scrollIntoView(false);
            break;
        } 
    }
    columns = document.querySelectorAll(".global-time");
    for (i = 0; i < columns.length; i++) {
        if (columns[i].textContent === "" && !columns[i].classList.contains("special")) {
            columns[i].textContent = formatTime(time);
            break;
        } 
    }

    if (final) {
        let cubeNumber = execRow.querySelector(".cube-number");
        let perCubeArea = execRow.querySelector(".per-cube");
        let execTime = Math.round(splitTime/Number(cubeNumber.textContent));
        let memoTime = time - splitTime
        perCubeArea.textContent = formatTime(execTime);

        let splitTimeLocal = memoRow.querySelector(".split-time");
        let globalTimeLocal = memoRow.querySelector(".global-time");
        perCubeArea = memoRow.querySelector(".per-cube");
        splitTimeLocal.textContent = "N/A";
        globalTimeLocal.textContent = formatTime(memoTime);
        perCubeArea.textContent = formatTime(Math.round(memoTime/Number(cubeNumber.textContent)));

        splitTimeLocal = totalRow.querySelector(".split-time");
        globalTimeLocal = totalRow.querySelector(".global-time");
        perCubeArea = totalRow.querySelector(".per-cube");
        splitTimeLocal.textContent = "N/A";
        globalTimeLocal.textContent = formatTime(time);
        perCubeArea.textContent = formatTime(Math.round(time/Number(cubeNumber.textContent)));

        globalTimeLocal.scrollIntoView(false);

    } else {
    columns = document.querySelectorAll(".per-cube");
        for (i = 0; i < columns.length; i++) {
            if (columns[i].textContent === "" && !columns[i].classList.contains("special")) {
                let cubeInput = columns[i].parentElement.querySelector(".cube-number input");
                columns[i].textContent = formatTime(Math.round(splitTime/cubeInput.value));
                break;
            } 
        }
    }
}

function startTimer() {
    if (document.activeElement.nodeName !== "INPUT") {
        currentSplit++;
        interval = setInterval(incrementTimer, 10);
        timerState = "running";
        buttonArea.style.display = "none";
        pastAttempts.style.display = "none";
    }
}

function performSplit(finalSplit) {
    currentSplit++;
    displayTime(finalSplit);
    splitTime = 0;
}


function performUnsplit() {
    let rowsReverse = rows.slice().reverse();

    for (let i=0; i < rowsReverse.length; i++) {
        if (rowsReverse[i].querySelector(".split-time").textContent !== "") {          
            currentSplit--;
            let pastSplitTime = unformatTime(rowsReverse[i].querySelector(".split-time").textContent);
            splitTime += pastSplitTime;

            rowsReverse[i].querySelector(".split-time").textContent = "";
            rowsReverse[i].querySelector(".global-time").textContent = "";
            rowsReverse[i].querySelector(".per-cube").textContent = "";
            break;
        }
    }
}

function stopTimer() {
    realTimeStorage = time;
    realExecTimeStorage = unformatTime(execRow.querySelector(".split-time").textContent)
    clearInterval(interval);
    timerState = "done";
    currentSplit = 0;
    timerSecondary.style.display = "none";
    displayTime(false);
    document.getElementById("reset-area").style.display = "flex";
    if (time > hour && unformatTime(memoRow.querySelector(".global-time").textContent) < hour) {
        document.querySelector(".suphour").style.display = "block";
    } else {
        document.querySelector(".suphour").style.display = "none";
    }

    document.getElementById("out-of-n").textContent = "/" + totalCubes.toString();
    document.getElementById("accuracy-input").value = totalCubes;
    document.getElementById("accuracy-input").max = totalCubes;
    timer.textContent = formatTime(time);
    attemptEndTime = new Date();
}

function incrementTimer() {
    time++;
    splitTime++;

    switch(preferences.timerDisplay) {
        case "global":
            timer.textContent = formatTime(time);
            break;
        case "split":
            timer.textContent = formatTime(splitTime);
            break;
        case "both":
            timer.textContent = formatTime(time);
            timerSecondary.textContent = formatTime(splitTime);
            break;
        case "nothing":
            if (currentSplit === splitsTotal) {
                timer.textContent = "exec";
            } else {
            timer.textContent = "memo";
            }
            break;
    }

    if (time === hour && preferences.bell) {
        bell.play();
    }
}

function addSplit(name, cubes, type) {
    if (timerState === "ready") {
        splitsTotal++;
        let row = document.createElement("tr");
        row.setAttribute("class", "row");
        row.dataset.cubes = preferences.defaultCubes.toString();
        (document.querySelector(".spreadsheet")).append(row);
        rows.push(row);

        let elements = [];

        for (let i = 0; i < 6; i++) {
            elements.push(document.createElement("td"));
            row.append(elements[elements.length - 1]);
            switch (i) {
                case 0:
                    elements[i].setAttribute("class", "split-name");
                    let input1 = document.createElement("input");
                    elements[i].append(input1);
                    input1.setAttribute("class", "name-input");
                    input1.setAttribute("placeholder", "Type name...")
                    input1.setAttribute("value", name);
                    break;
                case 1:
                    elements[i].setAttribute("class", "split-time");
                    break;
                case 2:
                    elements[i].setAttribute("class", "global-time");
                    break;
                case 3:
                    elements[i].setAttribute("class", "cube-number");
                    input2 = document.createElement("input");
                    elements[i].append(input2);
                    input2.setAttribute("id", "cube-input");
                    input2.setAttribute("value", cubes);
                    input2.type = "number";
                    input2.setAttribute("min", 1);
                    input2.setAttribute("tabindex", -1);
                    input2.setAttribute("onfocusout", "validateCubeNumberInput(this)");
                    input2.addEventListener("input", (event) => {updateCubeNumber()});
                    break;
                case 4:
                    elements[i].setAttribute("class", "per-cube");
                    break;
                case 5:
                    elements[i].setAttribute("class", "type");
                    elements[i].addEventListener("click", (event) => {changeType(event)});
                    elements[i].setAttribute("data-type", "memo");
                    elements[i].textContent = "Memo";
                    if (type === "review") {
                        elements[i].dispatchEvent(new Event("click"));
                    }
                    break;
            }
        }
        updateCubeNumber();
    }
}

document.getElementById("add-split").onclick = () => {
    addSplit("", preferences.defaultCubes, "memo");
}

document.getElementById("delete-split").onclick = () => {
    if (timerState === "ready") {
        try {
            rows[rows.length-1].remove();
            rows.pop()
            splitsTotal--;
            updateCubeNumber();
        }
        catch(_error) {
            //pass
        }
    }
}

function addLeadingZero(string) {
    if (Number(string) === 0) {
        string = "00";
    } else if (Number(string) < 10) {
        string = "0" + string;
    }

    return string;
}

function updateCubeNumber() {
    totalCubes = 0;
    for (let i=0; i<rows.length; i++) {
        if (rows[i].querySelector(".type").getAttribute("data-type") === "memo") {
            totalCubes += Number(rows[i].querySelector(".cube-number input").value);
        }
    }
    document.getElementById("exec-row").querySelector(".cube-number").textContent = totalCubes.toString();
    document.getElementById("total-memo-row").querySelector(".cube-number").textContent = totalCubes.toString();
    document.getElementById("total-row").querySelector(".cube-number").textContent = totalCubes.toString();
}

function updateDefaultCubes() {
    preferences.defaultCubes = document.querySelector("[name=default-cubes-input]").value;
    localStorage.setItem("preferences", JSON.stringify(preferences));
}

function formatTime(number) {
    let centiseconds = addLeadingZero((number % 100).toString());
    let seconds = (Math.floor((number / 100)%60)).toString();
    let minutes = (Math.floor((number / 6000))%60).toString();
    let hours = (Math.floor(number / hour)).toString();

    if (Number(minutes) === 0 && Number(hours) === 0) {
        return cutOffDigits(seconds + "." + centiseconds);
    } else if (Number(hours) === 0) {
        return cutOffDigits(`${minutes}:${addLeadingZero(seconds)}.${centiseconds}`);
    } else {
        return cutOffDigits(`${hours}:${addLeadingZero(minutes)}:${addLeadingZero(seconds)}.${centiseconds}`);
    }
}

function unformatTime(time) {
    let timeArray = time.split(":");
    let newTime;

    switch (timeArray.length) {
        case 1:
            newTime = parseFloat(timeArray[0]) * 100;
            break;
        case 2: 
            newTime = parseInt(timeArray[0]) * 6000 + parseFloat(timeArray[1]) * 100;
            break;
        case 3:
            newTime = parseInt(timeArray[0]) * hour + parseInt(timeArray[1]) * 6000 + parseFloat(timeArray[2]) * 100;
            break;
    }

    return (newTime - plusTwos*200);
}

function cutOffDigits(time) {
    switch (preferences.timerPrecision) {
        case "hundredth":
            return time;
        case "tenth":
            return time.slice(0, -1);
        case "second":
            return time.slice(0, -3);
    }
}

function changeColor(object, color) {
    let children = object.querySelectorAll("td, input");
    for (let i = 0; i<children.length; i++) {
        children[i].style.backgroundColor = color;
    }
}

function changeType(event) {
    if (editing) {
        let object = event.target;
        let parent = object.parentElement;
        switch (object.dataset.type) {
            case("review"):
                object.textContent = "Memo";
                object.dataset.type = "memo";
                changeColor(parent, "#6488EA");
                break;
            case("memo"):
                object.textContent = "Review";
                object.dataset.type = "review";
                changeColor(parent, "#4E6AB6");

                updateCubeNumber();
                if (totalCubes === 0) {
                    object.textContent = "Memo";
                    object.dataset.type = "memo";
                    changeColor(parent, "#6488EA");
                }
                break;
        }
        updateCubeNumber();
    }
}

function changeTimerMode(event) {
    let button = event.target;
    preferences.timerDisplay = button.value;
    if (preferences.timerDisplay === "both") {
        timerSecondary.style.display = "block";
    } else {
        timerSecondary.style.display = "none";
    }
    localStorage.setItem("preferences", JSON.stringify(preferences));
}

function changeTimerPrecision(event) {
    let button = event.target;
    preferences.timerPrecision = button.value;
    localStorage.setItem("preferences", JSON.stringify(preferences));
}

function stringifyReviewSystem() {
    let outputArray = new Array;

    for (i=0; i < rows.length; i++) {
        let splitNameValue = rows[i].querySelector(".split-name input").value;
        let cubeNumberValue = rows[i].querySelector(".cube-number input").value;
        let typeValue = rows[i].querySelector(".type").getAttribute("data-type");
        outputArray.push([splitNameValue, cubeNumberValue, typeValue].join(","));
    }
    
    return outputArray.join("#");
}

function createReviewSystem() {
    document.querySelector(".spreadsheet-div").style.visibility = "visible";
    document.querySelector("#save-div").style.display = "flex";
    document.querySelector("#add-split").style.display = "block";
    document.querySelector("#delete-split").style.display = "block";
    document.querySelector("#load-div").style.display = "none";
    pastAttempts.innerHTML = "";

    document.getElementById("review-system-name-header").textContent = "";
    document.getElementById("review-system-name").value = "";

    let rowsToDelete = document.getElementsByClassName("row");
    while (rowsToDelete.length > 0) {
        rowsToDelete[0].parentNode.removeChild(rowsToDelete[0]);
    }
    rows = [];
    updateCubeNumber();
    toggleInputTo(true);
    editorMode = "create";
    setPlaceholdersTo("Type name...");
    toggleReviewSystemAlert(false);
}

function editReviewSystem() {
    document.querySelector(".spreadsheet-div").style.visibility = "visible";
    document.querySelector("#save-div").style.display = "flex";
    document.querySelector("#add-split").style.display = "block";
    document.querySelector("#delete-split").style.display = "block";
    document.querySelector("#load-div").style.display = "none";

    toggleInputTo(true);
    editorMode = "edit";
    setPlaceholdersTo("Type name...");
}

function saveReviewSystem() {
    let name = document.getElementById("review-system-name").value;

    if (name === "") {
        alert("Please add a name to save your review system.");
    } else if (totalCubes === 0) {
        alert("Can't make a review system with zero cubes.");

    } else {
        switch (editorMode) {
            case "create":
                let conflictFound = false;
                for (let key in reviewSystemStorage) {
                    if (key === name) {
                        alert("Can't make a review system with the same name as an existing one.");
                        conflictFound = true;
                        break;
                    }
                }
                if (!conflictFound) {
                    Object.defineProperty(reviewSystemStorage, [name], {value:stringifyReviewSystem(), enumerable: true, configurable: true});
                    localStorage.setItem("save", JSON.stringify(reviewSystemStorage));
            
                    document.querySelector("#save-div").style.display = "none";
                    document.querySelector("#add-split").style.display = "none";
                    document.querySelector("#delete-split").style.display = "none";
                    document.querySelector("#load-div").style.display = "flex";
            
                    localStorage.setItem("lastLoaded", stringifyReviewSystem());
                    localStorage.setItem("lastLoadedName", name)
                    document.getElementById("review-system-name-header").textContent = localStorage.getItem("lastLoadedName");
            
                    toggleInputTo(false);
            
                    loadReviewSystem(null, false);
                    document.getElementById("edit-button").style.display = "block";
                    setPlaceholdersTo("");
                }
                break;
            
            case "edit":
                let oldName = localStorage.getItem("lastLoadedName");
                delete reviewSystemStorage[oldName];
                Object.defineProperty(reviewSystemStorage, [name], {value:stringifyReviewSystem(), enumerable: true, configurable: true});
                localStorage.setItem("save", JSON.stringify(reviewSystemStorage));
        
                document.querySelector("#save-div").style.display = "none";
                document.querySelector("#add-split").style.display = "none";
                document.querySelector("#delete-split").style.display = "none";
                document.querySelector("#load-div").style.display = "flex";

                for (let key in attempts) {
                    if (attempts[key].reviewSystem === oldName) {
                        attempts[key].reviewSystem = name;
                    }
                }
                localStorage.setItem("attempts", JSON.stringify(attempts));
        
                localStorage.setItem("lastLoaded", stringifyReviewSystem());
                localStorage.setItem("lastLoadedName", name)
                document.getElementById("review-system-name-header").textContent = localStorage.getItem("lastLoadedName");
        
                toggleInputTo(false);
        
                loadReviewSystem(localStorage.getItem("lastLoaded"));
                document.getElementById("edit-button").style.display = "block";
                setPlaceholdersTo("");
        }
    }
    showSaved();
    showSaved();
}

function exit() {
    document.querySelector("#save-div").style.display = "none";
    document.querySelector("#add-split").style.display = "none";
    document.querySelector("#delete-split").style.display = "none";
    document.querySelector("#load-div").style.display = "flex";

    toggleInputTo(false);

    loadReviewSystem(null, false);
}

function showSaved() {
    reviewSystemStorage = JSON.parse(localStorage.getItem("save"));
    let table = document.getElementById("saved-review-systems")
    let loadButton = document.getElementById("load-button")

    if (table.style.display !== "block") {
        table.style.display = "block";
        table.innerHTML = "";
        loadButton.innerHTML = "Load review system ▲"
    } else {
        table.style.display = "none";
        loadButton.innerHTML = "Load review system ▼"
    }

    for (let key in reviewSystemStorage) {
        let element = document.createElement("tr");
        let button = document.createElement("button");
        let xButton = document.createElement("button");
        table.appendChild(element);

        element.appendChild(button);
        button.innerHTML = key;
        button.addEventListener("click", (event) => {loadReviewSystem(event, true)});
        button.classList.add("load-button");

        element.appendChild(xButton);
        xButton.innerHTML = "x"
        xButton.addEventListener("click", (event) => {deleteReviewSystem(event)});
        button.classList.add("x-button");
    }
}

function loadReviewSystem(event, fromButton) {
    let load = JSON.parse(localStorage.getItem("save"));
    let reviewSystem;

    if (fromButton) {
        localStorage.setItem("lastLoaded", load[event.target.innerHTML]);
        reviewSystem = load[event.target.innerHTML].split("#");
    } else {
        reviewSystem = localStorage.getItem("lastLoaded").split("#");
    }

    splitsTotal = 1;

    while (rows.length > 0) {
        let last = rows.pop();
        last.remove();

    }

    for (i=0; i<reviewSystem.length; i++) {
        let splitArray = reviewSystem[i].split(",");
        toggleInputTo(true);
        addSplit(splitArray[0], parseInt(splitArray[1]), splitArray[2]);
        toggleInputTo(false);
    }
    if (fromButton) {
        document.getElementById("review-system-name").value = event.target.innerHTML;
        localStorage.setItem("lastLoadedName", event.target.innerHTML);
        showSaved();
    } else {
        document.getElementById("review-system-name").value = localStorage.getItem("lastLoadedName");
    }

    loadTable(false);
    displayAttempts();
}

function belongsTo(attempt, reviewSystem) {
    return attempt.reviewSystem !== reviewSystem;
}

function deleteReviewSystem(event) {
    if (confirm("Delete this review system? This will also delete all attempts on it.") === true) {
        let toDelete = event.target.previousSibling.innerHTML;
        event.target.parentElement.remove();
        
        reviewSystemStorage = JSON.parse(localStorage.getItem("save"));
        delete reviewSystemStorage[toDelete];
        localStorage.setItem("save", JSON.stringify(reviewSystemStorage));

        attempts = attempts.filter(function(attempt) {
            return belongsTo(attempt, toDelete);
        });

        localStorage.setItem("attempts", JSON.stringify(attempts));

        if (Object.keys(reviewSystemStorage).length !== 0) {
             localStorage.setItem("lastLoaded", reviewSystemStorage[0]);
             localStorage.setItem("lastLoadedName", document.getElementById("saved-review-systems").querySelector("tr .load-button").textContent);

             loadReviewSystem(null, false);
         } else {
            localStorage.setItem("lastLoaded", null);
            localStorage.setItem("lastLoadedName", null);
            document.getElementById("edit-button").style.display = "none";

            loadTable(false);
         }

         displayAttempts();
         showSaved();
    }
}

document.getElementById('accuracy-input').onblur = function (event) {
    if ( Number(event.target.value) < event.target.min) {
        event.target.value = event.target.min;
    } else if ( Number(event.target.value) > event.target.max) {
    event.target.value = event.target.max;
    } else if (event.target.value === "") {
        event.target.value = event.target.max;
    }
}

function formatDate(mls) {
    date = new Date(mls);
    let text = date.getDate().toString() + "/";
    text += (date.getMonth() + 1).toString() + "/";
    text += date.getFullYear();

    return text;
}

function displayDialog(header, text) {
    dialog.showModal();
    dialog.style.display = "block";
    document.getElementById("dialog-header").textContent = header;
    document.getElementById("dialog-text").textContent = text;
}

function displayEditDialog(notes, accuracy, cubeNumber) {

    document.getElementById("edit-notes-input").value = notes;
    document.getElementById("accuracy-edit").value = accuracy;
    document.getElementById("out-of-n-edit").textContent = "/" + cubeNumber;

    editDialog.showModal();
    editDialog.style.display = "flex";
}

function editAttempt() {
    let attempt = attempts[attemptIndex];
    attempt.notes = document.getElementById("edit-notes-input").value;
    attempt.solved = document.getElementById("accuracy-edit").value;
    attempt.summary = attempt.summary.replace(/\d+[/]\d+/g, attempt.solved + "/" + attempt.attempted);

    if (attempt.summary.includes("Notes:") && document.getElementById("edit-notes-input").value !== "") {
        attempt.summary = attempt.summary.replace(/(?<=Notes: ).*/g, `${document.getElementById("edit-notes-input").value}`);
    } else if (document.getElementById("edit-notes-input").value !== "") {
        attempt.summary = attempt.summary.replace(/\n(?=Generated by MBLD Timer)/, `\nNotes: ${document.getElementById("edit-notes-input").value}\n\n`);
    } else {
        attempt.summary = attempt.summary.replace(/\n\nNotes: .*/g, "");
    }

    localStorage.setItem("attempts", JSON.stringify(attempts));
    exitDialog(editDialog);
    displayAttempts();
}

function exitDialog(dialog) {
    dialog.style.display = "none";
    editing = false;
    dialog.close();
}

function copyDialogText() {
    navigator.clipboard.writeText(document.getElementById("dialog-text").textContent);
}

function displayAttempts() {
    loadAttempts();
    pastAttempts.innerHTML = "";
    retypeAttempts();
    for (let i=0; i < attempts.length; i++) {
        if (attempts[i].reviewSystem === localStorage.getItem("lastLoadedName")) {
            new PastAttemptRow(attempts[i]);
        }
    }
}

function retypeAttempts() {
    let temp = [];
    loadAttempts();

    for (let i=0; i < attempts.length; i++) {
        let tempAttempt = new Attempt;
        Object.assign(tempAttempt, attempts[i])
        temp.push(tempAttempt);
    }

    attempts = temp;
}

function deletePastAttempt(event) {
    if (window.confirm("Delete this attempt?")) {
        attempts.splice(attempts.indexOf(event.target.parentElement.parentElement.attempt), 1);
        localStorage.setItem("attempts", JSON.stringify(attempts));
        displayAttempts();
    }
}

function validateCubeNumberInput(inputField) {
    if (inputField.value === "" || inputField.value < 1 || inputField.value == null) {
        inputField.value = preferences.defaultCubes;
    }

    updateCubeNumber();
}

function validateAccuracyInput(inputField) {
    if (inputField.value === "" || inputField.value < 1 || inputField.value == null || inputField.value > totalCubes) {
        inputField.value = 0;
    }
}

function updateHeaderText(value) {
    document.getElementById("review-system-name-header").textContent = value;
}

function toggleNotesInput() {
    editing = !editing;
}

function saveToFile() {
    masterSave = {
        attempts: localStorage.getItem("attempts"),
        lastLoaded: localStorage.getItem("lastLoaded"),
        lastLoadedName: localStorage.getItem("lastLoadedName"),
        preferences: localStorage.getItem("preferences"),
        save: localStorage.getItem("save"),
    };

    if (Object.keys(JSON.parse(masterSave.save)).length === 0) {
        alert("No review systems to save.");
    } else {
        const blob = new Blob([JSON.stringify(masterSave)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        document.getElementById("save-link").href = url;
    }
}

function loadFromFile() {
    const fileSource = document.getElementById("file-input");
    const fileUrl = URL.createObjectURL(fileSource.files[0]);
    fileSource.value = "";

    fetch(fileUrl)
        .then(response => response.json())
        .then(data => {
            localStorage.setItem("attempts", data.attempts);
            localStorage.setItem("lastLoaded", data.lastLoaded);
            localStorage.setItem("lastLoadedName", data.lastLoadedName);
            localStorage.setItem("preferences", data.preferences);
            localStorage.setItem("save", data.save);

            loadTable(true);
            displayAttempts();
            document.getElementById("edit-button").style.display = "block";
            toggleReviewSystemAlert(false);
        });
}

function setPlaceholdersTo(str) {
    let sheet = document.getElementById("normal-rows");

    for (let row of Array.from(sheet.children)) {
        if (row.classList.contains("row")) {
            row.querySelector(".split-name .name-input").placeholder = str;
        }
    }
}

function toggleReviewSystemAlert(bool) {
    let alert = document.getElementById("no-review-system-alert");
    
    switch (bool) {
        case true:
            alert.style.display = "block";
            break;
        case false:
            alert.style.display = "none";
            break;
    }
}





