// This is the server side (more like expressjs) javascript. This file is not run on client side

var express = require('express');
var router = express.Router();
var SSE = require('express-sse');
var sse = new SSE();

var serverGameStatus = {numPlayer: 0, 
						numRound: 0,
						currentRound: 0,
						instructorRequestOk: false,
						playerList: [], 
						playerGameData: {}	// playerName : [round Data]
						};	// keep a record at server. In the future this should be per session.

function clearServerGameStatus() {
	serverGameStatus.numPlayer = 0;
	serverGameStatus.numRound = 0;
	serverGameStatus.currentRound = 0;
	serverGameStatus.playerList = [];
	serverGameStatus.playerGameData = {};
}

/*
 * POST to start game.
 */
 // In the future might want to distinguish by session ids rather than instructor ids.
router.post('/startGame', function(req, res) {
    //var db = req.db;
    //console.log('Received game start request.');
    // TODO: 1. record this game 2. ACK back client (instructor game page)
    // 3. There should be a list of players, server should communicate with them as well.
    clearServerGameStatus();
    serverGameStatus.numPlayer = req.body.numPlayers;
    serverGameStatus.numRound = req.body.numRounds;
    //serverGameStatus.playerList = [];
    for (var i = 1; i <= serverGameStatus.numPlayer; ++ i) {
    	serverGameStatus.playerList.push('testPlayer' + i);
    	serverGameStatus.playerGameData['testPlayer' + i] = [];
    }
    serverGameStatus.instructorRequestOk = true;
    gameGen(serverGameStatus);
    //console.log(serverGameStatus);

    //res.gameStartOk = true;
    //res.playerNames = serverGameStatus.playerList;
    // TODO: think about what need to be echoed back.
    res.send(serverGameStatus);
});

/*
 * Game number generator
 */
 function gameGen(serverGameStatus) {
 	console.log('In gameGen()');
 	for (var player in serverGameStatus.playerGameData) {
 		serverGameStatus.playerGameData[player].push({supply: 200, cost: 10.0, order: serverGameStatus.currentRound === 0 ? 50 : ''});
 	}
 };

/*
 * POST to go to next round.
 */
router.post('/nextRound', function(req, res) {
	serverGameStatus.currentRound ++;
	gameGen(serverGameStatus);
    res.send(serverGameStatus);
});

router.get('/getPlayerTable/:player', function(req, res) {
	var player = req.params.player;
	console.log('Player ' + player + ' just requested game table.');
	if (serverGameStatus.playerGameData.hasOwnProperty(player)) {
		//console.log('Sending data: ' + serverGameStatus.playerGameData[player]);
		res.send(serverGameStatus.playerGameData[player]);
	}
	else
		// Need to handle error correctly
		throw 'No record in playerGameData for ' + player;
});

router.post('/submitOrder/:player', function(req, res) {
	var player = req.params.player;
	var order = req.body.newOrder;
	console.log('Recived order ' + order + ' from ' + player);
	//console.log('To update ' + serverGameStatus.playerGameData[player]);
	var thisPlayerData = serverGameStatus.playerGameData[player];
	// console.log(thisPlayerData.length + ' ' + serverGameStatus.currentRound);
	thisPlayerData[serverGameStatus.currentRound].order = order;
	//serverGameStatus.playerGameData[player][serverGameStatus.currentRound].order = order;
	sse.send({player: player, order: order}, 'message');
});

// SSE
// router.get('/stream', function(req, res) {
// 	console.log('Requested stream.');
// 	res.writeHead(200, {
// 	    'Content-Type': 'text/event-stream',
// 	    'Cache-Control': 'no-cache',
// 	    'Connection': 'keep-alive'
//   	});
//   	res.write('\n');
// 	// res.write("data: " + JSON.stringify({name: 'test'}) + "\n\n");
// 	// connections.push(res);
// });

router.get('/stream', sse.init);

// / SSE

module.exports = router;