// Game page from instructor's perspective
// This is a single page application.
var gameData = {};

// DOM Ready =============================================================
$(document).ready(function() {

    // Populate the user table on initial page load
    // At the begining client should fetch game data from server.
    //populateGameTable();
    registerActions();
});

function registerActions() {
	$('#formSetupGame #btnStart').on('click', startGame);
	$('#formSetupGame #btnReset').on('click', resetGame);
	$('#btnNextRnd').on('click', nextRound);
	$('#btnNextRnd').prop("disabled", true);

	var source = new EventSource('/game/stream');
	source.addEventListener('message', function(e) {
        var data = JSON.parse(e.data);
        var cr = gameData.serverGameData.currentRound;
        var player = data.player;
        var order = data.order;
        console.log(data);
        $('#tdOrderId3').html(order);
      }, false);
	source.addEventListener('open', function(e) {
        console.log('EventSource connected');
      }, false);

    source.addEventListener('error', function(e) {
        if (e.target.readyState == EventSource.CLOSED) {
          console.log('EventSource disconnected.');
        }
        else if (e.target.readyState == EventSource.CONNECTING) {
          console.log('Connecting to EventSource.');
        }
      }, false);
};

// Display game table
function populateGameTable(response) {
	var gameTableContent;
	//console.log(gameData);
	console.log(response.playerGameData);
	var counter = response.currentRound * 3;
	$.each(response.playerGameData, function(index, value)  {
		//console.log('index2: ' + index2 + ', value2: ' + value2);
		var playerGameDisp = value[response.currentRound];
		//console.log(index + ': ' + playerGameDisp);
	    gameTableContent += '<tr>';
        gameTableContent += '<td>' + response.currentRound + '</td>';	// Round
        gameTableContent += '<td>' + index + '</td>';	// Player
        gameTableContent += '<td>' + playerGameDisp.supply + '</td>';	//supply
        gameTableContent += '<td>' + playerGameDisp.cost + '</td>';	// cost
        var tdOrderId = counter ++;
        gameTableContent += '<td id="tdOrderId' + tdOrderId + '">' + playerGameDisp.order + '</td>';	// order
        gameTableContent += '</tr>';
	});
	//$('#gameTable table tbody').html(gameTableContent);
	$('#gameTableBlock table tbody').append(gameTableContent);
	// Disable start game button.
	$('#formSetupGame #btnStart').prop('disabled', true);
	$('#formSetupGame #inputNumberOfGroups').prop('disabled', true);
	$('#formSetupGame #inputNumberOfRounds').prop('disabled', true);
};

function startGame(event) {
	event.preventDefault();

	var errCount = 0;
	// 
	$('#formSetupGame input').each(function(index, val) {
		if($(this).val() === '' || $(this).val <= 0) { errCount ++; }
	})

	if (errCount === 0) {
		// Probably can do assignment while validating values so don't need to select DOM objects more than once
		gameData.numPlayers = $('#formSetupGame #inputNumberOfGroups').val();
		gameData.numRounds = $('#formSetupGame #inputNumberOfRounds').val();
		// TODO: Should be what instructor logged in as.
		//gameData.instructor = 'instructor1';
		//console.log(gameData);
		$.ajax({
            type: 'POST',
            data: gameData,
            url: '/game/startGame',
            dataType: 'JSON'
        }).done(function( response ) {
        	if (response.instructorRequestOk === true) {
        		gameData.serverGameData = response;
        		console.log("Game status ok by server.")
        		populateGameTable(gameData.serverGameData);
        		// Maybe this logic can be put somewhere else. This is only for first round
        		$('#btnNextRnd').prop("disabled", false);
        	} else {
        		alert(response.gameStartErr);
        	}
        });
	} else {
		alert('Please fill both fields with valid values.');
	}
};

function resetGame(event) {
	event.preventDefault();
	var r = confirm('Reset game will lose all current game data.');
	if (r === true) {
		console.log('Reset game button clicked.');
		$.ajax({
            type: 'POST',
            data: gameData,
            url: '/game/resetGame',
            dataType: 'JSON'
        }).done(function( response ) {
        	if (response.instructorRequestOk === true) {
        		window.location.reload();
        	}
        });
	}
};

function nextRound(event) {
	event.preventDefault();

	$.ajax({
        type: 'POST',
        data: {},
        url: '/game/nextRound',
        dataType: 'JSON'
    }).done(function( response ) {
    	if (response.instructorRequestOk === true) {
    		gameData.serverGameData = response;
    		//gameData.serverGameData.currentRound ++;
    		populateGameTable(gameData.serverGameData);
    		$('#btnNextRnd').prop("disabled", true);
    	} else {

    	}
    });
};