// Module dependencies
var express		= require('express'),
    mysql		= require('mysql'),
    xml2js		= require('xml2js'),
    fs			= require('fs');

// Application initialization
var connection = mysql.createConnection({
        host     : '127.0.0.1',
        user     : 'msmith',
        password : '4617618',
        multipleStatements : false,
        supportBigNumbers : true
    });
    
var app = module.exports = express.createServer();

// Database setup
connection.query('USE msmith', function (err) {
    if (err) throw err;
});

// Configuration
app.use(express.bodyParser());
//app.use(bodyParser.urlencoded({ extended: false }));

// Static Public Files
app.use(express.static('public'));

// Standard Header/Footer
var htmlHeader = '<html><head><title>CPMA Maxstats</title></head><body>';
var htmlFooter = '</body></html>';

function handleError(res, error) {
    res.send(htmlHeader + error.toString() + htmlFooter);
}

// Match Struct
function Match_s(Datetime, Map, Type) {
	this.Datetime = Datetime;
	this.Map = Map;
	this.Type = Type;
}

// PlayerStats Struct
function PlayerStats_s(Name, Score, Kills, Deaths, Suicides, Net, DamageGiven, DamageTaken, 
					HealthTotal, ArmorTotal, Captures, Assists, Defense, Returns) {
	this.Name = Name;
	this.Score = Score;
	this.Kills = Kills;
	this.Deaths = Deaths;
	this.Suicides = Suicides;
	this.Net = Net;
	this.DamageGiven = DamageGiven;
	this.DamageTaken = DamageTaken;
	this.HealthTotal = HealthTotal;
	this.ArmorTotal = ArmorTotal;
	this.Captures = Captures;
	this.Assists = Assists;
	this.Defense = Defense;
	this.Returns = Returns;
}

// ItemStats Struct
function ItemStats_s(MHPickups, RAPickups, YAPickups, GAPickups, QuadPickups, BSPickups, 
					InvisPickups, FlightPickups, RegenPickups, FlagGrabs, QuadTime, BSTime, 
					InvisTime, FlightTime, RegenTime, FlagTime) {
	this.MHPickups = MHPickups;
	this.RAPickups = RAPickups;
	this.YAPickups = YAPickups;
	this.GAPickups = GAPickups;
	this.QuadPickups = QuadPickups;
	this.BSPickups = BSPickups;
	this.InvisPickups = InvisPickups;
	this.FlightPickups = FlightPickups;
	this.RegenPickups = RegenPickups;
	this.FlagGrabs = FlagGrabs;
	this.QuadTime = QuadTime;
	this.BSTime = BSTime;
	this.InvisTime = InvisTime;
	this.FlightTime = FlightTime;
	this.RegenTime = RegenTime;
	this.FlagTime = FlagTime;
}

// WeaponStats Struct
function WeaponStats_s(GKills, MGKills, MGShots, MGHits, SGKills, SGShots, 
					SGHits, PGKills, PGShots, PGHits, RLKills, RLShots, RLHits, LGKills, 
					LGShots, LGHits, RGKills, RGShots, RGHits, GLKills, GLShots, GLHits, BFGKills, 
					BFGShots, BFGHits, TFKills) {
	this.GKills = GKills;
	this.MGKills = MGKills;
	this.MGShots = MGShots;
	this.MGHits = MGHits;
	this.SGKills = SGKills;
	this.SGShots = SGShots;
	this.SGHits = SGHits;
	this.PGKills = PGKills;
	this.PGShots = PGShots;
	this.PGHits = PGHits;
	this.RLKills = RLKills;
	this.RLShots = RLShots;
	this.RLHits = RLHits;
	this.LGKills = LGKills;
	this.LGShots = LGShots;
	this.LGHits = LGHits;
	this.RGKills = RGKills;
	this.RGShots = RGShots;
	this.RGHits = RGHits;
	this.GLKills = GLKills;
	this.GLShots = GLShots;
	this.GLHits = GLHits;
	this.BFGKills = BFGKills;
	this.BFGShots = BFGShots;
	this.BFGHits = BFGHits;
	this.TFKills = TFKills;
}

// Input: Maxstats XML String
// Output: Insertion into database
// Throws: Parse Error, MySQL Error
function parseXMLData(res, xmldata) {
	// Convert to JSON... zzzz
	var jsondata;
	xml2js.parseString(xmldata, function(err, jsondata) {
		if (jsondata == null) {
			throw new Error("Empty JSON Object.");
		}

		console.log(JSON.stringify(jsondata));
		
		var type = jsondata["match"]["$"]["type"];
		var isTeamGame = jsondata["match"]["$"]["isTeamGame"];
		console.log(type);
		console.log(isTeamGame);
		
		if (isTeamGame == "true") {
			if (type == "TDM") {
				throw new Error("Unsupported gametype.");
			}
			else if (type == "CTF") {
				throw new Error("Unsupported gametype.");
			}
			else {
				throw new Error("Invalid XML file specified.");
			}
		}
		else if (isTeamGame == "false") {
			if (type == "1v1") {
				parseDuelData(res, jsondata);
			}
			else if (type == "FFA") {
				throw new Error("Unsupported gametype.");
			}
			else {
				throw new Error("Invalid XML file specified.");
			}
		}
		else {
			throw new Error("Invalid XML file specified.");
		}
	});
}

// Input: Maxstats JSON Duel Data
// Output: Insertion into database
// Throws: Parse Error, MySQL Error
function parseDuelData(res, jsondata) {
	var Match = parseDuelMatch(jsondata);
	
	var P1PlayerStats = parseDuelPlayerStats(0, jsondata);
	var P1ItemStats = parseDuelItemStats(0, jsondata);
	var P1WeaponStats = parseDuelWeaponStats(0, jsondata);
	
	var P2PlayerStats = parseDuelPlayerStats(1, jsondata);
	var P2ItemStats = parseDuelItemStats(1, jsondata);
	var P2WeaponStats = parseDuelWeaponStats(1, jsondata);

	// Begin async hell
	var PIDS = [0, 0];
	var p1done = false;
	var p2done = false;

	getPlayerID(res, P1PlayerStats.Name, player1IDCallback);
	getPlayerID(res, P2PlayerStats.Name, player2IDCallback);

	function player1IDCallback(PID) {
	    PIDS[0] = PID;
	    p1done = true;
	    if (p1done && p2done) {
	        parseDuelData2(res, Match, PIDS[0], P1PlayerStats, P1ItemStats, P1WeaponStats, PIDS[1], P2PlayerStats, P2ItemStats, P2WeaponStats);
	    }
	}

	function player2IDCallback(PID) {
	    PIDS[1] = PID;
        p2done = true;
        if (p1done && p2done) {
            parseDuelData2(res, Match, PIDS[0], P1PlayerStats, P1ItemStats, P1WeaponStats, PIDS[1], P2PlayerStats, P2ItemStats, P2WeaponStats);
        }
    }
}

// Part 2 of parseDuelData
function parseDuelData2(res, Match, P1ID, P1PlayerStats, P1ItemStats, P1WeaponStats, P2ID, P2PlayerStats, P2ItemStats, P2WeaponStats) {
    var query = 'INSERT INTO Matches(Datetime, Type, Map) VALUES(' + connection.escape(Match.Datetime) + ', ' + connection.escape(Match.Type) + ', ' + connection.escape(Match.Map) + ')';
    console.log("parseDuelData2: %s", query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log("parseDuelData2: %s", err.toString());
                handleError(res, err);
            }
            else {
                var query2 = 'INSERT INTO PlayersMatches(PlayerID, MatchID) VALUES (' + connection.escape(P1ID) + ', ' + connection.escape(result.insertId) + ')';
                console.log("parseDuelData2: %s", query2);
                var result2 = connection.query(query2,
                    function (err2, result2) {
                        if (err2) {
                            console.log("parseDuelData2: %s", err2.toString());
                            handleError(res, err2);
                        }
                        else {
                            var query3 = 'INSERT INTO PlayersMatches(PlayerID, MatchID) VALUES (' + connection.escape(P2ID) + ', ' + connection.escape(result.insertId) + ')';
                            console.log("parseDuelData2: %s", query3);
                            var result3 = connection.query(query3,
                                function (err3, result3) {
                                    if (err3) {
                                        console.log("parseDuelData2: %s", err3.toString());
                                        handleError(res, err3);
                                    }
                                    else {
                                        console.log("matchid = %s", result3.insertId);
                                        parseDuelData3(res, Match, P1ID, P1PlayerStats, P1ItemStats, P1WeaponStats, P2ID, P2PlayerStats, P2ItemStats, P2WeaponStats, result.insertId);
                                    }
                                });
                        }
                    });
            }
        });
}

// Part 3 of parseDuelData
function parseDuelData3(res, Match, P1ID, P1PlayerStats, P1ItemStats, P1WeaponStats, P2ID, P2PlayerStats, P2ItemStats, P2WeaponStats, MatchID) {
    // Create Stats Tables
    var StatsIDs = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    var p1pstatsdone = false;
    var p2pstatsdone = false;
    var p1itemstatsdone = false;
    var p2itemstatsdone = false;
    var p1weaponstatsdone = false;
    var p2weaponstatsdone = false;
    var eloupdated = false;

    if (+P1PlayerStats.Score > +P2PlayerStats.Score) {
        StatsIDs[6] = P1ID;
    }
    else {
        StatsIDs[6] = P2ID;
    }

    createPlayerStatsTable(res, P1PlayerStats, P1ID, p1PlayerStatsCallback);
    createPlayerStatsTable(res, P2PlayerStats, P2ID, p2PlayerStatsCallback);
    createItemStatsTable(res, P1ItemStats, P1ID, p1ItemStatsCallback);
    createItemStatsTable(res, P2ItemStats, P2ID, p2ItemStatsCallback);
    createWeaponStatsTable(res, P1WeaponStats, P1ID, p1WeaponStatsCallback);
    createWeaponStatsTable(res, P2WeaponStats, P2ID, p2WeaponStatsCallback);
    updateELO(res, P1ID, P2ID, StatsIDs[6], updateELOCallback);

    function p1PlayerStatsCallback(PstatsID) {
        StatsIDs[0] = PstatsID;
        p1pstatsdone = true;
        if (p1pstatsdone && p2pstatsdone && p1itemstatsdone && p2itemstatsdone && p1weaponstatsdone && p2weaponstatsdone && eloupdated) {
            parseDuelData4(res, MatchID, P1ID, P2ID, StatsIDs[0], StatsIDs[1], StatsIDs[2], StatsIDs[3], StatsIDs[4], StatsIDs[5], StatsIDs[6], StatsIDs[7], StatsIDs[8]);
        }
    }

    function p2PlayerStatsCallback(PstatsID) {
        StatsIDs[3] = PstatsID;
        p2pstatsdone = true;
        if (p1pstatsdone && p2pstatsdone && p1itemstatsdone && p2itemstatsdone && p1weaponstatsdone && p2weaponstatsdone && eloupdated) {
            parseDuelData4(res, MatchID, P1ID, P2ID, StatsIDs[0], StatsIDs[1], StatsIDs[2], StatsIDs[3], StatsIDs[4], StatsIDs[5], StatsIDs[6], StatsIDs[7], StatsIDs[8]);
        }
    }

    function p1ItemStatsCallback(IstatsID) {
        StatsIDs[1] = IstatsID;
        p1itemstatsdone = true;
        if (p1pstatsdone && p2pstatsdone && p1itemstatsdone && p2itemstatsdone && p1weaponstatsdone && p2weaponstatsdone && eloupdated) {
            parseDuelData4(res, MatchID, P1ID, P2ID, StatsIDs[0], StatsIDs[1], StatsIDs[2], StatsIDs[3], StatsIDs[4], StatsIDs[5], StatsIDs[6], StatsIDs[7], StatsIDs[8]);
        }
    }

    function p2ItemStatsCallback(IstatsID) {
        StatsIDs[4] = IstatsID;
        p2itemstatsdone = true;
        if (p1pstatsdone && p2pstatsdone && p1itemstatsdone && p2itemstatsdone && p1weaponstatsdone && p2weaponstatsdone && eloupdated) {
            parseDuelData4(res, MatchID, P1ID, P2ID, StatsIDs[0], StatsIDs[1], StatsIDs[2], StatsIDs[3], StatsIDs[4], StatsIDs[5], StatsIDs[6], StatsIDs[7], StatsIDs[8]);
        }
    }

    function p1WeaponStatsCallback(WstatsID) {
        StatsIDs[2] = WstatsID;
        p1weaponstatsdone = true;
        if (p1pstatsdone && p2pstatsdone && p1itemstatsdone && p2itemstatsdone && p1weaponstatsdone && p2weaponstatsdone && eloupdated) {
            parseDuelData4(res, MatchID, P1ID, P2ID, StatsIDs[0], StatsIDs[1], StatsIDs[2], StatsIDs[3], StatsIDs[4], StatsIDs[5], StatsIDs[6], StatsIDs[7], StatsIDs[8]);
        }
    }

    function p2WeaponStatsCallback(WstatsID) {
        StatsIDs[5] = WstatsID;
        p2weaponstatsdone = true;
        if (p1pstatsdone && p2pstatsdone && p1itemstatsdone && p2itemstatsdone && p1weaponstatsdone && p2weaponstatsdone && eloupdated) {
            parseDuelData4(res, MatchID, P1ID, P2ID, StatsIDs[0], StatsIDs[1], StatsIDs[2], StatsIDs[3], StatsIDs[4], StatsIDs[5], StatsIDs[6], StatsIDs[7], StatsIDs[8]);
        }
    }

    function updateELOCallback(ELOChange) {
        StatsIDs[7] = ELOChange[0];
        StatsIDs[8] = ELOChange[1];
        eloupdated = true;
        if (p1pstatsdone && p2pstatsdone && p1itemstatsdone && p2itemstatsdone && p1weaponstatsdone && p2weaponstatsdone && eloupdated) {
            parseDuelData4(res, MatchID, P1ID, P2ID, StatsIDs[0], StatsIDs[1], StatsIDs[2], StatsIDs[3], StatsIDs[4], StatsIDs[5], StatsIDs[6], StatsIDs[7], StatsIDs[8]);
        }
    }
}

// Input: Two PlayerIDs and who won
// Output: Updates both player's ELO Ranking, Returns changes
// Throws: MySQL Error
function updateELO(res, P1ID, P2ID, Winner, callback) {
    var query = 'SELECT ELO FROM Players WHERE PlayerID=' + connection.escape(P1ID)
              + ' OR PlayerID=' + connection.escape(P2ID);
    console.log('updateELO: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log("updateElo: %s", err.toString());
                handleError(res, err);
            }
            else if (result.length != 2) {
                err = new Error("updateElo: Result returned != 2");
                console.log("updateElo: %s", err.toString());
                handleError(res, err);
            }
            else {
                // ELO Algorithm
                var p1NewELO;
                var p2NewELO;
                var ELOChange = [0, 0];
                var p1Expected = 1/(1+10^((result[1].ELO-result[0].ELO)/400));
                var p2Expected = 1/(1+10^((result[0].ELO-result[1].ELO)/400));
                if (Winner == P1ID) {
                    p1NewELO = result[0].ELO + 30 * p1Expected;
                    p2NewELO = result[1].ELO - 30 * p2Expected;
                }
                else {
                    p1NewELO = result[0].ELO - 30 * p1Expected;
                    p2NewELO = result[1].ELO + 30 * p2Expected;
                }
                ELOChange[0] = result[0].ELO > p1NewELO ? result[0].ELO - p1NewELO : p1NewELO - result[0].ELO;
                ELOChange[1] = result[1].ELO > p2NewELO ? result[1].ELO - p2NewELO : p2NewELO - result[1].ELO;

                var query2 = 'UPDATE Players SET ELO=' + connection.escape(p1NewELO) + ' WHERE PlayerID=' + connection.escape(P1ID);
                console.log('updateELO: %s', query2);
                var result2 = connection.query(query2,
                    function (err2, result2) {
                        if (err2) {
                            console.log("updateELO: %s", err2.toString());
                            handleError(res, err2);
                        }
                    });

                var query3 = 'UPDATE Players SET ELO=' + connection.escape(p2NewELO) + ' WHERE PlayerID=' + connection.escape(P2ID);
                console.log('updateELO: %s', query3);
                var result3 = connection.query(query3,
                    function (err3, result3) {
                        if (err3) {
                            console.log("updateELO: %s", err3.toString());
                            handleError(res, err3);
                        }
                    });

                callback(ELOChange);
            }
        });
}

// Part 4 of parseDuelData
function parseDuelData4(res, MatchID, P1ID, P2ID, P1StatsID, P1ItemsID, P1WeaponsID, P2StatsID, P2ItemsID, P2WeaponsID, Winner, P1ELOChange, P2ELOChange) {
    var query = 'INSERT INTO DuelMatchStats(MatchID, Winner, P1ELOChange, P2ELOChange, Player1ID, Player2ID, Player1StatsID, Player2StatsID, Player1ItemsID, ';
    query += 'Player2ItemsID, Player1WeaponsID, Player2WeaponsID) VALUES (';
    query += connection.escape(MatchID) + ', ' + connection.escape(Winner) + ', ' + connection.escape(P1ELOChange) + ', ' + connection.escape(P2ELOChange);
    query += ', ' + connection.escape(P1ID) + ', ' + connection.escape(P2ID);
    query += ', ' + connection.escape(P1StatsID) + ', ' + connection.escape(P2StatsID);
    query += ', ' + connection.escape(P1ItemsID) + ', ' + connection.escape(P2ItemsID);
    query += ', ' + connection.escape(P1WeaponsID) + ', ' + connection.escape(P2WeaponsID) + ")";
    console.log("parseDuelData4: %s", query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log("parseDuelData4: %s", err.toString());
                handleError(res, err);
            }
            else {
                var query2 = 'UPDATE Players SET LastSeen=now() WHERE PlayerID=' + connection.escape(P1ID);
                console.log("parseDuelData4: %s", query2);
                var result2 = connection.query(query2,
                    function (err2, result2) {
                        if (err2) {
                            console.log("parseDuelData4: %s", err2.toString());
                            handleError(res, err2);
                        }
                        else {
                            var query3 = 'UPDATE Players SET LastSeen=now() WHERE PlayerID=' + connection.escape(P2ID);
                            console.log("parseDuelData4: %s", query3);
                            var result3 = connection.query(query3,
                                function (err3, result3) {
                                    if (err3) {
                                        console.log("parseDuelData4: %s", err3.toString());
                                        handleError(res, err3);
                                    }
                                    else {
                                        res.send(htmlHeader + "Successfully Added Match" + htmlFooter);
                                    }
                                });
                        }
                    });
            }
        });
}

// Input: PlayerStats_s PlayerID, Callback function
// Output: Inserts PlayerStats as new row, returns insertion id
//         Updates Player's global PlayerStats entry
// Throws: MySQL Error
function createPlayerStatsTable(res, PlayerStats, PlayerID, callback) {
    var query = 'INSERT INTO PlayerStats(PlayerID, Score, Kills, Deaths, Suicides, Net, DamageGiven, DamageTaken, ';
    query += 'Captures, Assists, Defense, Returns, HealthTotal, ArmorTotal) VALUES (' + connection.escape(PlayerID);
    query += ', ' + connection.escape(PlayerStats.Score) + ', ' + connection.escape(PlayerStats.Kills) + ', ' + connection.escape(PlayerStats.Deaths);
    query += ', ' + connection.escape(PlayerStats.Suicides) + ', ' + connection.escape(PlayerStats.Net) + ', ' + connection.escape(PlayerStats.DamageGiven);
    query += ', ' + connection.escape(PlayerStats.DamageTaken) + ', ' + connection.escape(PlayerStats.Captures) + ', ' + connection.escape(PlayerStats.Assists);
    query += ', ' + connection.escape(PlayerStats.Defense) + ', ' + connection.escape(PlayerStats.Returns) + ', ' + connection.escape(PlayerStats.HealthTotal);
    query += ', ' + connection.escape(PlayerStats.ArmorTotal) + ')';
    console.log("createPlayerStatsTable: %s", query);
    var result = connection.query(query,
        function(err, result) {
            if (err) {
                console.log("createPlayerStatsTable: %s", err.toString());
                handleError(res, err);
            }
            else {
                var query2 = 'SELECT PlayerStats FROM Players WHERE PlayerID=' + connection.escape(PlayerID);
                console.log("createPlayerStatsTable: %s", query2);
                var result2 = connection.query(query2,
                    function(err2, result2) {
                        if (err2) {
                            console.log("createPlayerStatsTable: %s", err2.toString());
                            handleError(res, err2);
                        }
                        else {
                             var query3 = 'UPDATE PlayerStats SET Score=Score +' + connection.escape(PlayerStats.Score)
                             + ', Kills=Kills +' + connection.escape(PlayerStats.Kills)
                             + ', Deaths=Deaths +' + connection.escape(PlayerStats.Deaths)
                             + ', Suicides=Suicides +' + connection.escape(PlayerStats.Suicides)
                             + ', Net=Net +' + connection.escape(PlayerStats.Net)
                             + ', DamageGiven=DamageGiven +' + connection.escape(PlayerStats.DamageGiven)
                             + ', DamageTaken=DamageTaken +' + connection.escape(PlayerStats.DamageTaken)
                             + ', Captures=Captures +' + connection.escape(PlayerStats.Captures)
                             + ', Assists=Assists +' + connection.escape(PlayerStats.Assists)
                             + ', Defense=Defense +' + connection.escape(PlayerStats.Defense)
                             + ', Returns=Returns +' + connection.escape(PlayerStats.Returns)
                             + ', HealthTotal=HealthTotal +' + connection.escape(PlayerStats.HealthTotal)
                             + ', ArmorTotal=ArmorTotal +' + connection.escape(PlayerStats.ArmorTotal)
                             + ' WHERE PlayerStatsID=' + connection.escape(result2[0].PlayerStats);
                             console.log("createPlayerStatsTable: %s", query3);
                             var result3 = connection.query(query3,
                                function (err3, result3) {
                                    if (err3) {
                                        console.log("createPlayerStatsTable: %s", err3.toString());
                                        handleError(res, err3);
                                    }
                                    else {
                                        callback(result.insertId);
                                    }
                                });
                        }
                    });

            }
        });
}

// Input: ItemStats_s PlayerID, Callback function
// Output: Inserts ItemStats as new row, returns insertion id
//         Updates Player's global ItemStats entry
// Throws: MySQL Error
function createItemStatsTable(res, ItemStats, PlayerID, callback) {
    var query = 'INSERT INTO ItemStats(PlayerID, MHPickups, RAPickups, YAPickups, GAPickups, QuadPickups, BSPickups, InvisPickups, ';
    query += 'FlightPickups, RegenPickups, FlagGrabs, QuadTime, BSTime, InvisTime, FlightTime, RegenTime, FlagTime) VALUES (';
    query += connection.escape(PlayerID) + ', ' + connection.escape(ItemStats.MHPickups) + ', ' + connection.escape(ItemStats.RAPickups);
    query += ', ' + connection.escape(ItemStats.YAPickups) + ', ' + connection.escape(ItemStats.GAPickups) + ', ' + connection.escape(ItemStats.QuadPickups);
    query += ', ' + connection.escape(ItemStats.BSPickups) + ', ' + connection.escape(ItemStats.InvisPickups) + ', ' + connection.escape(ItemStats.FlightPickups);
    query += ', ' + connection.escape(ItemStats.RegenPickups) + ', ' + connection.escape(ItemStats.FlagGrabs) + ', ' + connection.escape(ItemStats.QuadTime);
    query += ', ' + connection.escape(ItemStats.BSTime) + ', ' + connection.escape(ItemStats.InvisTime) + ', ' + connection.escape(ItemStats.FlightTime);
    query += ', ' + connection.escape(ItemStats.RegenTime) + ', ' + connection.escape(ItemStats.FlagTime) + ')';
    console.log("createItemStatsTable: %s", query);
    var result = connection.query(query,
        function(err, result) {
            if (err) {
                console.log("createItemStatsTable: %s", err.toString());
                handleError(res, err);
            }
            else {
                var query2 = 'SELECT ItemStats FROM Players WHERE PlayerID=' + connection.escape(PlayerID);
                console.log("createItemStatsTable: %s", query2);
                var result2 = connection.query(query2,
                    function (err2, result2) {
                        if (err2) {
                            console.log("createItemStatsTable: %s", err2.toString());
                            handleError(res, err2);
                        }
                        else {
                            var query3 = 'UPDATE ItemStats SET MHPickups=' + connection.escape(ItemStats.MHPickups)
                            + ', RAPickups=RAPickups +' + connection.escape(ItemStats.RAPickups)
                            + ', YAPickups=YAPickups +' + connection.escape(ItemStats.YAPickups)
                            + ', GAPickups=GAPickups +' + connection.escape(ItemStats.GAPickups)
                            + ', QuadPickups=QuadPickups +' + connection.escape(ItemStats.QuadPickups)
                            + ', BSPickups=BSPickups +' + connection.escape(ItemStats.BSPickups)
                            + ', InvisPickups=InvisPickups +' + connection.escape(ItemStats.InvisPickups)
                            + ', FlightPickups=FlightPickups +' + connection.escape(ItemStats.FlightPickups)
                            + ', RegenPickups=RegenPickups +' + connection.escape(ItemStats.RegenPickups)
                            + ', FlagGrabs=FlagGrabs +' + connection.escape(ItemStats.FlagGrabs)
                            + ', QuadTime=QuadTime +' + connection.escape(ItemStats.QuadTime)
                            + ', BSTime=BSTime +' + connection.escape(ItemStats.BSTime)
                            + ', InvisTime=InvisTime +' + connection.escape(ItemStats.InvisTime)
                            + ', FlightTime=FlightTime +' + connection.escape(ItemStats.FlightTime)
                            + ', RegenTime=RegenTime +' + connection.escape(ItemStats.RegenTime)
                            + ', FlagTime=FlagTime +' + connection.escape(ItemStats.FlagTime)
                            + ' WHERE ItemStatsID=' + connection.escape(result2[0].ItemStats);
                            console.log("createItemStatsTable: %s", query3);
                            var result3 = connection.query(query3,
                                function (err3, result3) {
                                    if (err3) {
                                        console.log("createItemStatsTable: %s", err3.toString());
                                        handleError(res, err3);
                                    }
                                    else {
                                        callback(result.insertId);
                                    }
                                });
                        }
                    });
            }
        });
}

// Input: WeaponStats_s PlayerID, Callback function
// Output: Inserts WeaponStats as new row, returns insertion id
//         Updates Player's global WeaponStats entry
// Throws: MySQL Error
function createWeaponStatsTable(res, WeaponStats, PlayerID, callback) {
    var query = 'INSERT INTO WeaponStats(PlayerID, GKills, MGKills, MGShots, MGHits, SGKills, SGShots, SGHits, PGKills, PGShots, PGHits, ';
    query += 'RLKills, RLShots, RLHits, LGKills, LGShots, LGHits, RGKills, RGShots, RGHits, BFGKills, BFGShots, BFGHits, GLKills, GLShots, GLHits, TFKills) VALUES (';
    query += connection.escape(PlayerID);
    query += ', ' + connection.escape(WeaponStats.GKills);
    query += ', ' + connection.escape(WeaponStats.MGKills) + ', ' + connection.escape(WeaponStats.MGShots) + ', ' + connection.escape(WeaponStats.MGHits);
    query += ', ' + connection.escape(WeaponStats.SGKills) + ', ' + connection.escape(WeaponStats.SGShots) + ', ' + connection.escape(WeaponStats.SGHits);
    query += ', ' + connection.escape(WeaponStats.PGKills) + ', ' + connection.escape(WeaponStats.PGShots) + ', ' + connection.escape(WeaponStats.PGHits);
    query += ', ' + connection.escape(WeaponStats.RLKills) + ', ' + connection.escape(WeaponStats.RLShots) + ', ' + connection.escape(WeaponStats.RLHits);
    query += ', ' + connection.escape(WeaponStats.LGKills) + ', ' + connection.escape(WeaponStats.LGShots) + ', ' + connection.escape(WeaponStats.LGHits);
    query += ', ' + connection.escape(WeaponStats.RGKills) + ', ' + connection.escape(WeaponStats.RGShots) + ', ' + connection.escape(WeaponStats.RGHits);
    query += ', ' + connection.escape(WeaponStats.BFGKills) + ', ' + connection.escape(WeaponStats.BFGShots) + ', ' + connection.escape(WeaponStats.BFGHits);
    query += ', ' + connection.escape(WeaponStats.GLKills) + ', ' + connection.escape(WeaponStats.GLShots) + ', ' + connection.escape(WeaponStats.GLHits);
    query += ', ' + connection.escape(WeaponStats.TFKills) + ')';
    console.log("createWeaponStatsTable: %s", query);
    var result = connection.query(query,
        function(err, result) {
            if (err) {
                console.log("createWeaponStatsTable: %s", err.toString());
                handleError(res, err);
            }
            else {
                var query2 = 'SELECT WeaponStats FROM Players WHERE PlayerID=' + connection.escape(PlayerID);
                console.log("createWeaponStatsTable: %s", query2);
                var result2 = connection.query(query2,
                    function(err2, result2) {
                        if (err2) {
                            console.log("createWeaponStatsTable: %s", err2.toString());
                            handleError(res, err2);
                        }
                        else {
                            var query3 = 'UPDATE WeaponStats SET GKills=' + connection.escape(WeaponStats.GKills)
                            + ', MGKills=MGKills +' + connection.escape(WeaponStats.MGKills)
                            + ', MGShots=MGShots +' + connection.escape(WeaponStats.MGShots)
                            + ', MGHits=MGHits +' + connection.escape(WeaponStats.MGHits)
                            + ', SGKills=SGKills +' + connection.escape(WeaponStats.SGKills)
                            + ', SGShots=SGShots +' + connection.escape(WeaponStats.SGShots)
                            + ', SGHits=SGHits +' + connection.escape(WeaponStats.SGHits)
                            + ', PGKills=PGKills +' + connection.escape(WeaponStats.PGKills)
                            + ', PGShots=PGShots +' + connection.escape(WeaponStats.PGShots)
                            + ', PGHits=PGHits +' + connection.escape(WeaponStats.PGHits)
                            + ', RLKills=RLKills +' + connection.escape(WeaponStats.RLKills)
                            + ', RLShots=RLShots +' + connection.escape(WeaponStats.RLShots)
                            + ', RLHits=RLHits +' + connection.escape(WeaponStats.RLHits)
                            + ', LGKills=LGKills +' + connection.escape(WeaponStats.LGKills)
                            + ', LGShots=LGShots +' + connection.escape(WeaponStats.LGShots)
                            + ', LGHits=LGHits +' + connection.escape(WeaponStats.LGHits)
                            + ', RGKills=RGKills +' + connection.escape(WeaponStats.RGKills)
                            + ', RGShots=RGShots +' + connection.escape(WeaponStats.RGShots)
                            + ', RGHits=RGHits +' + connection.escape(WeaponStats.RGHits)
                            + ', BFGKills=BFGKills +' + connection.escape(WeaponStats.BFGKills)
                            + ', BFGShots=BFGShots +' + connection.escape(WeaponStats.BFGShots)
                            + ', BFGHits=BFGHits +' + connection.escape(WeaponStats.BFGHits)
                            + ', GLKills=GLKills +' + connection.escape(WeaponStats.GLKills)
                            + ', GLShots=GLShots +' + connection.escape(WeaponStats.GLShots)
                            + ', GLHits=GLHits +' + connection.escape(WeaponStats.GLHits)
                            + ', TFKills=TFKills +' + connection.escape(WeaponStats.TFKills)
                            + ' WHERE WeaponStatsID=' + connection.escape(result2[0].WeaponStats);
                            console.log("createWeaponStatsTable: %s", query3);
                            var result3 = connection.query(query3,
                                function (err3, result3) {
                                    if (err3) {
                                        console.log("createWeaponStatsTable: %s", err3.toString());
                                        handleError(res, err3);
                                    }
                                    else {
                                        callback(result.insertId);
                                    }
                                });
                        }
                    });
            }
        });
}

// Input: Player Name, Callback function
// Output: If player does not exist, creates player, returns PlayerID
// Throws: MySQL error
function getPlayerID(res, playername, callback) {
	var query = 'SELECT PlayerID FROM Players WHERE Name=' + connection.escape(playername);
	console.log("getPlayerID: %s", query);
	
	var result = connection.query(query, 
		function(err, result) {
			if (err) {
				console.log("getPlayerID: %s", err.toString());
				handleError(res, err);
			}
			else if (result.length == 0) {
				var query2 = 'INSERT INTO Players(Name, FirstSeen, LastSeen) VALUES (' + connection.escape(playername) +', now(), now());';
				console.log("createPlayer: %s", query2);
				var result = connection.query(query2,
				function (err2, result) {
				    if (err2) {
				        console.log("createPlayer: %s", err2.toString());
				        handleError(res, err2);
				    }
				    else if (result.length == 0) {
				        err2 = new Error("createPlayer: Returned result.length=0");
				        console.log("createPlayer: %s", err2);
				        handleError(res, err2);
				    }
				    else {
				        createPlayerTables(res, result.insertId, callback);
				    }
				});
			}
			else {
				callback(result[0].PlayerID);
			}
	});
}

// Input: PlayerID, Callback function
// Output: Creates default global stats tables for playerid;
// Throws MySQL error
function createPlayerTables(res, pid, callback) {
    var query = 'INSERT INTO PlayerStats(PlayerID) VALUES (' + connection.escape(pid) + ')';
    console.log("createPlayerTables: %s", query);

    var result = connection.query(query,
        function(err, result) {
            if (err) {
                console.log("createPlayerTables: %s", err.toString());
                handleError(res, err);
            }
            else {
                var query2 = 'UPDATE Players SET PlayerStats=' + connection.escape(result.insertId) + ' WHERE PlayerID=' + connection.escape(pid);
                console.log("createPlayerTables: %s", query2);
                var result2 = connection.query(query2,
                    function (err2, result2) {
                        if (err2) {
                            console.log("createPlayerTables: %s", err2.toString());
                            handleError(res, err2);
                        }
                        else {
                            var query3 = 'INSERT INTO ItemStats(PlayerID) VALUES (' + connection.escape(pid) + ')';
                            console.log("createPlayerTables: %s", query3);
                            var result3 = connection.query(query3,
                                function (err3, result3) {
                                    if (err3) {
                                        console.log("createPlayerTables: %s", err3.toString());
                                        handleError(res, err3);
                                    }
                                    else {
                                        var query4 = 'UPDATE Players SET ItemStats=' + connection.escape(result3.insertId) + ' WHERE PlayerID=' + connection.escape(pid);
                                        console.log("createPlayerTables: %s", query4);
                                        var result4 = connection.query(query4,
                                            function (err4, result4) {
                                                if (err4) {
                                                    console.log("createPlayerTables: %s", err4.toString());
                                                    handleError(res, err4);
                                                }
                                                else {
                                                    var query5 = 'INSERT INTO WeaponStats(PlayerID) VALUES (' + connection.escape(pid) + ')';
                                                    console.log("createPlayerTables: %s", query5);
                                                    var result5 = connection.query(query5,
                                                        function (err5, result5) {
                                                            if (err5) {
                                                                console.log("createPlayerTables: %s", err5.toString());
                                                                handleError(res, err5);
                                                            }
                                                            else {
                                                                var query6 = 'UPDATE Players SET WeaponStats=' + connection.escape(result5.insertId) + ' WHERE PlayerID=' + connection.escape(pid);
                                                                console.log("createPlayerTables: %s", query6);
                                                                var result6 = connection.query(query6,
                                                                    function (err6, result6) {
                                                                        if (err6) {
                                                                            console.log("createPlayerTables: %s", err6.toString());
                                                                            handleError(res, err6);
                                                                        }
                                                                        else {
                                                                            callback(pid);
                                                                        }
                                                                });
                                                            }
                                                        });
                                                }
                                            });
                                    }
                                });
                        }
                    });
            }
        });
}

// Input: Duel MaxStats JSON Object
// Output: Returns Match_s
// Throws: Parse Error
function parseDuelMatch(jsondata) {
	var Datetime = jsondata["match"]["$"]["datetime"];
	var Map = jsondata["match"]["$"]["map"];
	var Type = jsondata["match"]["$"]["type"];
	
	var match = new Match_s(Datetime, Map, Type);
	
	console.log("===== Match Stats =====");
	console.log(Datetime);
	console.log(Map);
	console.log(Type);
	console.log("===== End Match Stats =====");
	
	return match;
}

// Input: Player Number, Maxstats JSON Object
// Output: Returns PlayerStats_s
// Throws: Parse failure
function parseDuelPlayerStats(playerNum, jsondata) {
	var Name = getDuelName(playerNum, jsondata);
	var Score = getDuelPlayerStats(playerNum, "Score", jsondata);
	var Kills = getDuelPlayerStats(playerNum, "Kills", jsondata);
	var Deaths = getDuelPlayerStats(playerNum, "Deaths", jsondata);
	var Suicides = getDuelPlayerStats(playerNum, "Suicides", jsondata);
	var Net = getDuelPlayerStats(playerNum, "Net", jsondata);
	var DamageGiven = getDuelPlayerStats(playerNum, "DamageGiven", jsondata);
	var DamageTaken = getDuelPlayerStats(playerNum, "DamageTaken", jsondata);
	var HealthTotal = getDuelPlayerStats(playerNum, "HealthTotal", jsondata);
	var ArmorTotal = getDuelPlayerStats(playerNum, "ArmorTotal", jsondata);
	var Captures = getDuelPlayerStats(playerNum, "Captures", jsondata);
	var Assists = getDuelPlayerStats(playerNum, "Assists", jsondata);
	var Defense = getDuelPlayerStats(playerNum, "Defense", jsondata);
	var Returns = getDuelPlayerStats(playerNum, "Returns", jsondata);
	
	var stats = new PlayerStats_s(Name, Score, Kills, Deaths, Suicides, Net, DamageGiven,
									DamageTaken, HealthTotal, ArmorTotal, Captures, Assists,
									Defense, Returns);

	console.log("===== Player Stats =====");
	console.log(stats.Name);
	console.log(stats.Score);
	console.log(stats.Kills);
	console.log(stats.Deaths);
	console.log(stats.Suicides);
	console.log(stats.Net);
	console.log(stats.DamageGiven);
	console.log(stats.DamageTaken);
	console.log(stats.HealthTotal);
	console.log(stats.ArmorTotal);
	console.log(stats.Captures);
	console.log(stats.Assists);
	console.log(stats.Defense);
	console.log(stats.Returns);
	console.log("===== End Player Stats =====");
	
	return stats;
}

// Input: Player Number, MaxStats JSON Object
// Output: Returns Player Name
// Throws: Parse Error
function getDuelName(playerNum, jsondata) {
	var player = jsondata["match"]["player"][playerNum]["$"]["name"];
	return player;
}

// Input: Player Number, 'name' Field's Name, MaxStats JSON Object
// Output: Returns corresponding value associated with field/name
// Throws: None
function getDuelPlayerStats(playerNum, name, jsondata) {
    try {
        for (var i=0; i<15; i++) {
            var search = jsondata["match"]["player"][playerNum]["stat"][i]["$"]["name"];
            if (search == name) {
                var result = jsondata["match"]["player"][playerNum]["stat"][i]["$"]["value"];
                break;
            }
        }
    }
    catch (err) {
        result = 0;
    }

    return result;
}

// Input: Player Number, Maxstats JSON Object
// Output: Returns ItemStats_s
// Throws: Parse failure
function parseDuelItemStats(playerNum, jsondata) {
	var MHPickups = getDuelItemStats(playerNum, "MH", "pickups", jsondata);
	var RAPickups = getDuelItemStats(playerNum, "RA", "pickups", jsondata);
	var YAPickups = getDuelItemStats(playerNum, "YA", "pickups", jsondata);
	var GAPickups = getDuelItemStats(playerNum, "GA", "pickups", jsondata);
	var QuadPickups = getDuelPowerupStats(playerNum, "Quad", "pickups", jsondata);
	var BSPickups = getDuelPowerupStats(playerNum, "BattleSuit", "pickups", jsondata);
	var InvisPickups = getDuelPowerupStats(playerNum, "Invis", "pickups", jsondata);
	var FlightPickups = getDuelPowerupStats(playerNum, "Flight", "pickups", jsondata);
	var RegenPickups = getDuelPowerupStats(playerNum, "Regen", "pickups", jsondata);
	var FlagGrabs = getDuelPowerupStats(playerNum, "Red Flag", "pickups", jsondata);
	var QuadTime = getDuelPowerupStats(playerNum, "Quad", "time", jsondata);
	var BSTime = getDuelPowerupStats(playerNum, "BattleSuit", "time", jsondata);
	var InvisTime = getDuelPowerupStats(playerNum, "Invis", "time", jsondata);
	var FlightTime = getDuelPowerupStats(playerNum, "Flight", "time", jsondata);
	var RegenTime = getDuelPowerupStats(playerNum, "Regen", "time", jsondata);
	var FlagTime = getDuelPowerupStats(playerNum, "Red Flag", "time", jsondata);
	
	var items = new ItemStats_s(MHPickups, RAPickups, YAPickups, GAPickups, QuadPickups,
								BSPickups, InvisPickups, FlightPickups, RegenPickups, 
								FlagGrabs, QuadTime, BSTime, InvisTime, FlightTime, RegenTime, FlagTime);

	console.log("===== Item Stats =====");
	console.log(MHPickups);
	console.log(RAPickups);
	console.log(YAPickups);
	console.log(GAPickups);
	console.log(QuadPickups);
	console.log(BSPickups);
	console.log(InvisPickups);
	console.log(FlightPickups);
	console.log(RegenPickups);
	console.log(FlagGrabs);
	console.log(QuadTime);
	console.log(BSTime);
	console.log(InvisTime);
	console.log(FlightTime);
	console.log(RegenTime);
	console.log(FlagTime);
	console.log("===== End Item Stats =====");
	
	return items;
}

// Input: Player Number, 'name' Field's Name, MaxStats JSON Object
// Output: Returns corresponding value associated with field/name
// Throws: None
function getDuelItemStats(playerNum, name, value, jsondata) {
    try {
        for (var i=0; i<15; i++) {
            var search = jsondata["match"]["player"][playerNum]["items"][0]["item"][i]["$"]["name"];
            if (search == name) {
                var result = jsondata["match"]["player"][playerNum]["items"][0]["item"][i]["$"][value];
                break;
            }
        }
    }
    catch (err) {
        result = 0;
    }

    return result;
}

// Input: Player Number, 'name' Field's Name, MaxStats JSON Object
// Output: Returns corresponding value associated with field/name
// Throws: None
function getDuelPowerupStats(playerNum, name, value, jsondata) {
    try {
        for (var i=0; i<15; i++) {
            var search = jsondata["match"]["player"][playerNum]["powerups"][0]["item"][i]["$"]["name"];
            if (search == name) {
                var result = jsondata["match"]["player"][playerNum]["powerups"][0]["item"][i]["$"][value];
                break;
            }
        }
    }
    catch (err) {
        result = 0;
    }

    return result;
}

// Input: Player Number, Maxstats JSON Object
// Output: Returns WeaponStats_s
// Throws: Parse failure
function parseDuelWeaponStats(playerNum, jsondata) {
	var GKills = getDuelWeaponStats(playerNum, "G", "kills", jsondata);
	var MGKills = getDuelWeaponStats(playerNum, "MG", "kills", jsondata);
	var MGShots = getDuelWeaponStats(playerNum, "MG", "shots", jsondata);
	var MGHits = getDuelWeaponStats(playerNum, "MG", "hits", jsondata);
	var SGKills = getDuelWeaponStats(playerNum, "SG", "kills", jsondata);
	var SGShots = getDuelWeaponStats(playerNum, "SG", "shots", jsondata);
	var SGHits = getDuelWeaponStats(playerNum, "SG", "hits", jsondata);
	var PGKills = getDuelWeaponStats(playerNum, "PG", "kills", jsondata);
	var PGShots = getDuelWeaponStats(playerNum, "PG", "shots", jsondata);
	var PGHits = getDuelWeaponStats(playerNum, "PG", "hits", jsondata);
	var RLKills = getDuelWeaponStats(playerNum, "RL", "kills", jsondata);
	var RLShots = getDuelWeaponStats(playerNum, "RL", "shots", jsondata);
	var RLHits = getDuelWeaponStats(playerNum, "RL", "hits", jsondata);
	var LGKills = getDuelWeaponStats(playerNum, "LG", "kills", jsondata);
	var LGShots = getDuelWeaponStats(playerNum, "LG", "shots", jsondata);
	var LGHits = getDuelWeaponStats(playerNum, "LG", "hits", jsondata);
	var RGKills = getDuelWeaponStats(playerNum, "RG", "kills", jsondata);
	var RGShots = getDuelWeaponStats(playerNum, "RG", "shots", jsondata);
	var RGHits = getDuelWeaponStats(playerNum, "RG", "hits", jsondata);
	var GLKills = getDuelWeaponStats(playerNum, "GL", "kills", jsondata);
	var GLShots = getDuelWeaponStats(playerNum, "GL", "shots", jsondata);
	var GLHits = getDuelWeaponStats(playerNum, "GL", "hits", jsondata);
	var BFGKills = getDuelWeaponStats(playerNum, "BFG", "kills", jsondata);
	var BFGShots = getDuelWeaponStats(playerNum, "BFG", "shots", jsondata);
	var BFGHits = getDuelWeaponStats(playerNum, "BFG", "hits", jsondata);
	var TFKills = getDuelWeaponStats(playerNum, "TF", "kills", jsondata);
	
	var weapons = new WeaponStats_s(GKills, MGKills, MGShots, MGHits, SGKills, SGShots, 
									SGHits, PGKills, PGShots, PGHits, RLKills, RLShots, 
									RLHits, LGKills, LGShots, LGHits, RGKills, RGShots, 
									RGHits, GLKills, GLShots, GLHits, BFGKills, BFGShots, 
									BFGHits, TFKills);

	console.log("===== Weapon Stats =====");
	console.log(GKills);
	console.log(MGKills);
	console.log(MGShots);
	console.log(MGHits);
	console.log(SGKills);
	console.log(SGShots);
	console.log(SGHits);
	console.log(PGKills);
	console.log(PGShots);
	console.log(PGHits);
	console.log(RLKills);
	console.log(RLShots);
	console.log(RLHits);
	console.log(LGKills);
	console.log(LGShots);
	console.log(LGHits);
	console.log(RGKills);
	console.log(RGShots);
	console.log(RGHits);
	console.log(GLKills);
	console.log(GLShots);
	console.log(GLHits);
	console.log(BFGKills);
	console.log(BFGShots);
	console.log(BFGHits);
	console.log(TFKills);
	console.log("===== End Weapon Stats =====");

	return weapons;
}

// Input: Player Number, 'name' Field's Name, 'value' Value's name MaxStats JSON Object
// Output: Returns corresponding value associated with field/name
// Throws: None
function getDuelWeaponStats(playerNum, name, value, jsondata) {
    try {
        for (var i=0; i<15; i++) {
            var search = jsondata["match"]["player"][playerNum]["weapons"][0]["weapon"][i]["$"]["name"];
            if (search == name) {
                var result = jsondata["match"]["player"][playerNum]["weapons"][0]["weapon"][i]["$"][value];
                break;
            }
        }
    }
    catch (err) {
        result = 0;
    }
	
    return result;
}

// Main page
app.get('/', function(req, res) {
    var query = 'SELECT DISTINCT p.PlayerID, p.Name, p.ELO, COUNT(m.MatchID) as GamesPlayed, '
              + 'SUM(CASE WHEN p.PlayerID=dm.Winner THEN 1 ELSE 0 END) as GamesWon, '
              + 'SUM(CASE WHEN p.PlayerID!=dm.Winner THEN 1 ELSE 0 END) as GamesLost '
              + 'FROM Players p '
              + 'INNER JOIN PlayersMatches pm '
              + 'ON p.PlayerID = pm.PlayerID '
              + 'INNER JOIN Matches m '
              + 'ON pm.MatchID = m.MatchID '
              + 'INNER JOIN DuelMatchStats dm '
              + 'ON m.MatchID = dm.MatchID '
              + 'GROUP BY p.PlayerID '
              + 'ORDER BY p.ELO DESC '
              + 'LIMIT 10';
    console.log("/: %s", query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log("/: %s", err.toString());
                res.send(htmlHeader + err.toString() + htmlFooter);
            }
            else {
                var query2 = 'SELECT DISTINCT p1.PlayerID as P1ID, p1.Name as P1Name, p1s.Score  as P1Score, p2.PlayerID as P2ID, '
                + 'p2.Name as P2Name, p2s.Score as P2Score, m.Map, m.Datetime, m.MatchID FROM Players p1 INNER JOIN PlayersMatches pm '
                + 'ON p1.PlayerID = pm.PlayerID INNER JOIN Matches m ON pm.MatchID = m.MatchID INNER JOIN DuelMatchStats dm ON m.MatchID '
                + '= dm.MatchID INNER JOIN PlayerStats p1s ON dm.Player1StatsID = p1s.PlayerStatsID INNER JOIN Players p2 ON dm.Player2ID '
                + '= p2.PlayerID INNER JOIN PlayerStats p2s ON dm.Player2StatsID = p2s.PlayerStatsID WHERE p1.PlayerID != p2.PlayerID '
                + 'ORDER BY m.Datetime DESC LIMIT 10';

                console.log("/: %s", query2);
                var result2 = connection.query(query2,
                    function (err2, result2) {
                        if (err2) {
                            console.log("/: %s", err2.toString());
                            res.send(htmlHeader + err2.toString() + htmlFooter);
                        }
                        else {
                        fs.readFile('./templates/Index.html', 'utf8',
                            function (fserr, data) {
                                if (fserr) {
                                    console.log("/: %s", fserr.toString());
                                    res.send(htmlHeader + fserr.toString() + htmlFooter);
                                }
                                else {
                                    for (var i=0; i<result.length; i++) {
                                        var row = generateTopRow(result[i].PlayerID, result[i].Name, result[i].ELO, result[i].GamesPlayed, result[i].GamesWon, result[i].GamesLost);
                                        data = data.replace('$toprow', row + '$toprow');
                                    }

                                    for (var j=0; j<result2.length; j++) {
                                        var row2;
                                        if (result2[j].P1Score > result2[j].P2Score) {
                                            row2 = generateRecentRow(result2[j].P1ID, result2[j].P1Name, result2[j].P1Score,
                                                       result2[j].P2Score, result2[j].P2ID, result2[j].P2Name, result2[j].Map,
                                                       result2[j].MatchID, result2[j].Datetime);
                                        }
                                        else {
                                            row2 = generateRecentRow(result2[j].P2ID, result2[j].P2Name, result2[j].P2Score,
                                                       result2[j].P1Score, result2[j].P1ID, result2[j].P1Name, result2[j].Map,
                                                       result2[j].MatchID, result2[j].Datetime);
                                        }
                                        data = data.replace('$recentrow', row2 + '$recentrow');
                                    }

                                    data = data.replace('$toprow', '');
                                    data = data.replace('$recentrow', '');
                                    res.send(data);
                                }
                            });
                        }
                    });
            }
        })
});

// Generates Index.html Top 10 Rows
function generateTopRow(PlayerID, PlayerName, ELORank, GamesPlayed, GamesWon, GamesLost) {
    var row = '<tr>'
            + '<td style="vertical-align: top;"><a href="/player?PlayerID=$playerid">$name</a><br></td>'
            + '<td style="vertical-align: top;">$elorank<br></td>'
            + '<td style="vertical-align: top;">$winpct<br></td>'
            + '<td style="vertical-align: top;">$gamesplayed<br></td>'
            + '<td style="vertical-align: top;">$gameswon<br></td>'
            + '<td style="vertical-align: top;">$gameslost<br></td>'
            + '</tr>';
    row = row.replace('$playerid', PlayerID);
    row = row.replace('$name', PlayerName);
    row = row.replace('$elorank', ELORank);
    var winpct = GamesLost==0 ? 1.000 : (GamesWon/(GamesWon+GamesLost));
    row = row.replace('$winpct', winpct.toFixed(3));
    row = row.replace('$gamesplayed', GamesPlayed);
    row = row.replace('$gameswon', GamesWon);
    row = row.replace('$gameslost', GamesLost);
    return row;
}

// Generates Index.html Latest Matches Rows
function generateRecentRow(WinnerID, WinnerName, WinnerScore, LoserScore, LoserID, LoserName, Map, MatchID, Date) {
    var row = '<tr>'
            + '<td style="vertical-align: top;"><a href="/player?PlayerID=$winnerid">$winnername</a><br></td>'
            + '<td style="vertical-align: top;">$winnerscore<br></td>'
            + '<td style="vertical-align: top;">$loserscore<br></td>'
            + '<td style="vertical-align: top;"><a href="/player?PlayerID=$loserid">$losername</a><br></td>'
            + '<td style="vertical-align: top;">$map<br></td>'
            + '<td style="vertical-align: top;"><a href="/match?MatchID=$matchid">$date</a><br></td>'
            + '</tr>';
    row = row.replace('$winnerid', WinnerID);
    row = row.replace('$winnername', WinnerName);
    row = row.replace('$winnerscore', WinnerScore);
    row = row.replace('$loserscore', LoserScore);
    row = row.replace('$loserid', LoserID);
    row = row.replace('$losername', LoserName);
    row = row.replace('$map', Map);
    row = row.replace('$matchid', MatchID);
    row = row.replace('$date', Date);
    return row;
}

// Player Page
app.get('/player', function (req, res) {
    var query = 'SELECT p.Name, p.FirstSeen, p.LastSeen, p.ELO, COUNT(m.MatchID) as GamesPlayed, '
              + 'SUM(CASE WHEN p.PlayerID=dm.Winner THEN 1 ELSE 0 END) as GamesWon, '
              + 'SUM(CASE WHEN p.PlayerID!=dm.Winner THEN 1 ELSE 0 END) as GamesLost, '
              + 'ps.Score, ps.Kills, ps.Deaths, '
              + 'ps.Suicides, ps.DamageGiven, ps.DamageTaken, ps.HealthTotal, ps.ArmorTotal, '
              + 'its.MHPickups, its.RAPickups, its.YAPickups, its.GAPickups, its.QuadPickups, its.BSPickups, '
              + 'its.InvisPickups, its.FlightPickups, its.RegenPickups, its.FlagGrabs, ws.GKills, ws.MGKills, '
              + 'ws.MGShots, ws.MGHits, ws.SGKills, ws.SGShots, ws.SGHits, ws.PGKills, ws.PGShots, '
              + 'ws.PGHits, ws.RLKills, ws.RLShots, ws.RLHits, ws.LGKills, ws.LGShots, ws.LGHits, '
              + 'ws.RGKills, ws.RGShots, ws.RGHits, ws.BFGKills, ws.BFGShots, ws.BFGHits, '
              + 'ws.GLKills, ws.GLShots, ws.GLHits, ws.TFKills '
              + 'FROM Players p '
              + 'INNER JOIN PlayerStats ps '
              + 'ON p.PlayerStats=ps.PlayerStatsID '
              + 'INNER JOIN ItemStats its '
              + 'ON p.ItemStats=its.ItemStatsID '
              + 'INNER JOIN WeaponStats ws '
              + 'ON p.WeaponStats=ws.WeaponStatsID '
              + 'INNER JOIN PlayersMatches pm '
              + 'ON p.PlayerID=pm.PlayerID '
              + 'INNER JOIN Matches m '
              + 'ON pm.MatchID = m.MatchID '
              + 'INNER JOIN DuelMatchStats dm '
              + 'ON m.MatchID = dm.MatchID '
              + 'WHERE p.PlayerID=' + connection.escape(req.query.PlayerID);
    console.log("/player: %s", query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log("/player: %s", err.toString());
                res.send(htmlHeader + err.toString() + htmlFooter);
            }
            else if (result.length != 1) {
                res.send(htmlHeader + "Player not found." + htmlFooter);
            }
            else {
                fs.readFile('./templates/Player.html', 'utf8',
                    function (fserr, data) {
                        if (fserr) {
                            console.log("/player: %s", fserr.toString());
                            res.send(htmlHeader + fserr.toString() + htmlFooter);
                        }
                        else {
                            var query2 = 'SELECT DISTINCT p1.Name as P1Name, p2.Name as P2Name, m.MatchID, m.Datetime, m.Map, dm.P1ELOChange, dm.P2ELOChange, dm.Player1ID, '
                                       + 'dm.Player2ID, ps1.Score as P1Score, ps2.Score as P2Score '
                                       + 'FROM Players p1 '
                                       + 'INNER JOIN PlayersMatches pm '
                                       + 'ON p1.PlayerID = pm.PlayerID '
                                       + 'INNER JOIN Matches m '
                                       + 'ON pm.MatchID = m.MatchID '
                                       + 'INNER JOIN DuelMatchStats dm '
                                       + 'ON m.MatchID = dm.MatchID '
                                       + 'INNER JOIN Players p2 '
                                       + 'ON dm.Player2ID = p2.PlayerID '
                                       + 'INNER JOIN PlayerStats ps1 '
                                       + 'ON dm.Player1StatsID=ps1.PlayerStatsID '
                                       + 'INNER JOIN PlayerStats ps2 '
                                       + 'ON dm.Player2StatsID=ps2.PlayerStatsID '
                                       + 'WHERE p1.PlayerID=' + connection.escape(req.query.PlayerID) + ' XOR '
                                       + 'p2.PlayerID=' + connection.escape(req.query.PlayerID) + ' '
                                       + 'ORDER BY Datetime DESC';
                            console.log("/player: %s", query2);
                            var result2 = connection.query(query2,
                                function (err2, result2) {
                                    if (err2) {
                                        console.log("/player: %s", err2.toString());
                                        res.send(htmlHeader + err2.toString() + htmlFooter);
                                    }
                                    else if (result2.length > 0) {
                                        data = data.replace("$name", result[0].Name);
                                        data = data.replace("$rank", result[0].ELO);
                                        data = data.replace("$firstseen", result[0].FirstSeen);
                                        data = data.replace("$lastseen", result[0].LastSeen);
                                        data = data.replace("$gamesplayed", result[0].GamesPlayed);
                                        data = data.replace("$gameswon", result[0].GamesWon);
                                        data = data.replace("$gameslost", result[0].GamesLost);
                                        data = data.replace("$score", result[0].Score);
                                        data = data.replace("$tkills", result[0].Kills);
                                        data = data.replace("$tdeaths", result[0].Deaths);
                                        data = data.replace("$tsuicides", result[0].Suicides);
                                        data = data.replace("$dmggiven", result[0].DamageGiven);
                                        data = data.replace("$dmgtaken", result[0].DamageTaken);
                                        var efficiency = result[0].DamageTaken > 0 ? (result[0].DamageGiven/result[0].DamageTaken)*100 : 0
                                        data = data.replace("$efficiency", efficiency.toFixed(2) + '%');
                                        data = data.replace("$thealth", result[0].HealthTotal);
                                        data = data.replace("$tarmor", result[0].ArmorTotal);
                                        data = data.replace("$gkills", result[0].GKills);
                                        data = data.replace("$mgkills", result[0].MGKills);
                                        data = data.replace("$mgshots", result[0].MGShots);
                                        data = data.replace("$mghits", result[0].MGHits);
                                        var mgacc = result[0].MGShots > 0 ? (result[0].MGHits/result[0].MGShots)*100 : 0;
                                        data = data.replace("$mgacc", mgacc.toFixed(2) + '%');
                                        data = data.replace("$sgkills", result[0].SGKills);
                                        data = data.replace("$sgshots", result[0].SGShots);
                                        data = data.replace("$sghits", result[0].SGHits);
                                        var sgacc = result[0].SGShots > 0 ? (result[0].SGHits/result[0].SGShots)*100 : 0;
                                        data = data.replace("$sgacc", sgacc.toFixed(2) + '%');
                                        data = data.replace("$pgkills", result[0].PGKills);
                                        data = data.replace("$pgshots", result[0].PGShots);
                                        data = data.replace("$pghits", result[0].PGHits);
                                        var pgacc = result[0].PGShots > 0 ? (result[0].PGHits/result[0].PGShots)*100 : 0;
                                        data = data.replace("$pgacc", pgacc.toFixed(2) + '%');
                                        data = data.replace("$lgkills", result[0].LGKills);
                                        data = data.replace("$lgshots", result[0].LGShots);
                                        data = data.replace("$lghits", result[0].LGHits);
                                        var lgacc = result[0].LGShots > 0 ? (result[0].LGHits/result[0].LGShots)*100 : 0;
                                        data = data.replace("$lgacc", lgacc.toFixed(2) + '%');
                                        data = data.replace("$rlkills", result[0].RLKills);
                                        data = data.replace("$rlshots", result[0].RLShots);
                                        data = data.replace("$rlhits", result[0].RLHits);
                                        var rlacc = result[0].RLShots > 0 ? (result[0].RLHits/result[0].RLShots)*100 : 0;
                                        data = data.replace("$rlacc", rlacc.toFixed(2) + '%');
                                        data = data.replace("$rgkills", result[0].RGKills);
                                        data = data.replace("$rgshots", result[0].RGShots);
                                        data = data.replace("$rghits", result[0].RGHits);
                                        var rgacc = result[0].RGShots > 0 ? (result[0].RGHits/result[0].RGShots)*100 : 0;
                                        data = data.replace("$rgacc", rgacc.toFixed(2) + '%');
                                        data = data.replace("$glkills", result[0].GLKills);
                                        data = data.replace("$glshots", result[0].GLShots);
                                        data = data.replace("$glhits", result[0].GLHits);
                                        var glacc = result[0].GLShots > 0 ? (result[0].GLHits/result[0].GLShots)*100 : 0;
                                        data = data.replace("$glacc", glacc.toFixed(2) + '%');
                                        data = data.replace("$bfgkills", result[0].BFGKills);
                                        data = data.replace("$bfgshots", result[0].BFGShots);
                                        data = data.replace("$bfghits", result[0].BFGHits);
                                        var bfgacc = result[0].BFGShots > 0 ? (result[0].BFGHits/result[0].BFGShots)*100 : 0;
                                        data = data.replace("$bfgacc", bfgacc.toFixed(2) + '%');
                                        data = data.replace("$tfkills", result[0].TFKills);
                                        data = data.replace("$rapickup", result[0].RAPickups);
                                        data = data.replace("$yapickup", result[0].YAPickups);
                                        data = data.replace("$gapickup", result[0].GAPickups);
                                        data = data.replace("$mhpickup", result[0].MHPickups);
                                        data = data.replace("$quadpickup", result[0].QuadPickups);
                                        data = data.replace("$bspickup", result[0].BSPickups);
                                        data = data.replace("$invispickup", result[0].InvisPickups);
                                        data = data.replace("$regenpickup", result[0].RegenPickups);
                                        data = data.replace("$hastepickup", 0); // how the fak did i forget haste
                                        data = data.replace("$flightpickup", result[0].FlightPickups);
                                        data = data.replace("$flagpickup", result[0].FlagGrabs);

                                        // Recent Matches
                                        data = data.replace("$p1name", result[0].Name + '\'s');
                                        for (var i=0; i<result2.length; i++) {
                                            var Win;
                                            var OpponentName;
                                            var OpponentID;
                                            var ELOChange;
                                            var P1Score;
                                            var P2Score;
                                            if (result2[i].P1Name == result[0].Name) {
                                                Win = +result2[i].P1Score > +result2[i].P2Score ? 1 : 2;
                                                OpponentName = result2[i].P2Name;
                                                OpponentID = result2[i].Player2ID;
                                                ELOChange = result2[i].P1ELOChange;
                                                P1Score = result2[i].P1Score;
                                                P2Score = result2[i].P2Score;
                                            }
                                            else {
                                                Win = +result2[i].P2Score > +result2[i].P1Score ? 1 : 2;
                                                OpponentName = result2[i].P1Name;
                                                OpponentID = result2[i].Player1ID;
                                                ELOChange = result2[i].P2ELOChange;
                                                P1Score = result2[i].P2Score;
                                                P2Score = result2[i].P1Score;
                                            }
                                            var row = generatePlayerMatchRow(Win, result2[i].MatchID, OpponentName, OpponentID, ELOChange,
                                            result2[i].Datetime, result2[i].Map, P1Score, P2Score);
                                            data = data.replace("$matchrow", row + '$matchrow');
                                        }
                                    }
                                    data = data.replace("$matchrow", '');
                                    res.send(data);
                                });

                        }
                    });

            }
        });
});

// Generates rows for /player's Latest Matches table
function generatePlayerMatchRow(Win, MatchID, OpponentName, OpponentID, ELOChange, Date, Map, P1Score, P2Score) {
    var won = '<img style="border: 0px solid ;" alt="Won"'
            + 'src="/images/uparrow.png"></a><br></td>';
    var lost = '<img style="border: 0px solid ;" alt="Lost"'
            + 'src="/images/downarrow.png"></a><br></td>';

    var row = '<tr>'
            + '<td style="vertical-align: top; text-align: center;">'
            + '<a href="/match?MatchID=$matchid">$wonlost'
            + '<td style="vertical-align: top;"><a href="/player?PlayerID=$opponentid">$opponentname</a><br></td>'
            + '<td style="vertical-align: top; color: $color;">$elochange<br></td>'
            + '<td style="vertical-align: top;"><a href="/match?MatchID=$matchid2">$date</a><br></td>'
            + '<td style="vertical-align: top;">$map<br></td>'
            + '<td style="vertical-align: top;">$p1score<br></td>'
            + '<td style="vertical-align: top;">$p2score<br></td>'
            + '</tr>';

    row = row.replace("$matchid", MatchID);
    row = row.replace("$matchid2", MatchID);
    row = row.replace("$opponentname", OpponentName);
    row = row.replace("$opponentid", OpponentID);
    row = row.replace("$date", Date);
    row = row.replace("$map", Map);
    row = row.replace("$p1score", P1Score);
    row = row.replace("$p2score", P2Score);

    if (Win == 1) {
        row = row.replace("$wonlost", won);
        row = row.replace("$elochange", '+' + ELOChange);
        row = row.replace("$color", "green");
    }
    else {
        row = row.replace("$wonlost", lost);
        row = row.replace("$elochange", '-' + ELOChange);
        row = row.replace("$color", "red");
    }

    return row;
}

// Match Stats Upload Page
app.get('/api/addmatch', function(req, res) {
	var responseHTML = htmlHeader 
	+ '<form id="upload" enctype="multipart/form-data" action="/api/addmatch/upload" method="post">'
	+ '<input type="file" name="matchdata" />'
	+ '<br><input type="submit" value="Upload" name="submit"><br />'
	+ '</form>';
	
	res.send(responseHTML);
});

// Match Stats Upload Handler
app.post('/api/addmatch/upload', function(req, res) {
	try {
		var path = req.files["matchdata"]["path"];
	
		// Read temp file
		var xmldata = fs.readFileSync(path, "utf8");
		//console.log(xmldata);
		
		// Delete temp file
		fs.unlink(path);

		// It Begins...
		parseXMLData(res, xmldata);
	}
	catch (err) {
	    console.log('/api/addmatch/upload: %s', err);
		handleError(res, err);
	}
});

// Match Page
app.get('/match', function(req, res) {
    var query = 'SELECT m.Datetime, m.Map, dm.Winner, p1.PlayerID as P1ID, p1.Name as P1Name, dm.P1ELOChange, dm.P2ELOChange, p1.ELO as P1ELO, p2.ELO as P2ELO, '
              + 'p1s.Score as P1Score, p1s.Suicides as P1Suicides, '
              + 'p1s.DamageGiven as P1DamageGiven, p1s.DamageTaken as P1DamageTaken, p1s.HealthTotal as P1HealthTotal, p1s.ArmorTotal as P1ArmorTotal, '
              + 'p1w.GKills as P1GKills, '
              + 'p1w.MGKills as P1MGKills, p1w.MGShots as P1MGShots, p1w.MGHits as P1MGHits, '
              + 'p1w.SGKills as P1SGKills, p1w.SGShots as P1SGShots, p1w.SGHits as P1SGHits, '
              + 'p1w.PGKills as P1PGKills, p1w.PGShots as P1PGShots, p1w.PGHits as P1PGHits, '
              + 'p1w.RLKills as P1RLKills, p1w.RLShots as P1RLShots, p1w.RLHits as P1RLHits, '
              + 'p1w.LGKills as P1LGKills, p1w.LGShots as P1LGShots, p1w.LGHits as P1LGHits, '
              + 'p1w.RGKills as P1RGKills, p1w.RGShots as P1RGShots, p1w.RGHits as P1RGHits, '
              + 'p1w.BFGKills as P1BFGKills, p1w.BFGShots as P1BFGShots, p1w.BFGHits as P1BFGHits, '
              + 'p1w.GLKills as P1GLKills, p1w.GLShots as P1GLShots, p1w.GLHits as P1GLHits, '
              + 'p1w.TFKills as P1TFKills, '
              + 'p1t.MHPickups as P1MHPickups, p1t.RAPickups as P1RAPickups, p1t.YAPickups as P1YAPickups, p1t.GAPickups as P1GAPickups, '
              + 'p2.PlayerID as P2ID, p2.Name as P2Name, p2s.Score as P2Score, p2s.Suicides as P2Suicides, '
              + 'p2s.DamageGiven as P2DamageGiven, p2s.DamageTaken as P2DamageTaken, p2s.HealthTotal as P2HealthTotal, p2s.ArmorTotal as P2ArmorTotal, '
              + 'p2w.GKills as P2GKills, '
              + 'p2w.MGKills as P2MGKills, p2w.MGShots as P2MGShots, p2w.MGHits as P2MGHits, '
              + 'p2w.SGKills as P2SGKills, p2w.SGShots as P2SGShots, p2w.SGHits as P2SGHits, '
              + 'p2w.PGKills as P2PGKills, p2w.PGShots as P2PGShots, p2w.PGHits as P2PGHits, '
              + 'p2w.RLKills as P2RLKills, p2w.RLShots as P2RLShots, p2w.RLHits as P2RLHits, '
              + 'p2w.LGKills as P2LGKills, p2w.LGShots as P2LGShots, p2w.LGHits as P2LGHits, '
              + 'p2w.RGKills as P2RGKills, p2w.RGShots as P2RGShots, p2w.RGHits as P2RGHits, '
              + 'p2w.BFGKills as P2BFGKills, p2w.BFGShots as P2BFGShots, p2w.BFGHits as P2BFGHits, '
              + 'p2w.GLKills as P2GLKills, p2w.GLShots as P2GLShots, p2w.GLHits as P2GLHits, '
              + 'p2w.TFKills as P2TFKills, '
              + 'p2t.MHPickups as P2MHPickups, p2t.RAPickups as P2RAPickups, p2t.YAPickups as P2YAPickups, p2t.GAPickups as P2GAPickups '
              + 'FROM Matches m '
              + 'INNER JOIN DuelMatchStats dm '
              + 'ON m.MatchID = dm.MatchID '
              + 'INNER JOIN PlayerStats p1s '
              + 'ON dm.Player1StatsID = p1s.PlayerStatsID '
              + 'INNER JOIN PlayerStats p2s '
              + 'ON dm.Player2StatsID = p2s.PlayerStatsID '
              + 'INNER JOIN WeaponStats p1w '
              + 'ON dm.Player1WeaponsID = p1w.WeaponStatsID '
              + 'INNER JOIN WeaponStats p2w '
              + 'ON dm.Player2WeaponsID = p2w.WeaponStatsID '
              + 'INNER JOIN Players p1 '
              + 'ON p1.PlayerID = dm.Player1ID '
              + 'INNER JOIN Players p2 '
              + 'ON p2.PlayerID = dm.Player2ID '
              + 'INNER JOIN ItemStats p1t '
              + 'ON dm.Player1ItemsID = p1t.ItemStatsID '
              + 'INNER JOIN ItemStats p2t '
              + 'ON dm.Player2ItemsID = p2t.ItemStatsID '
              + 'WHERE m.MatchID=' + connection.escape(req.query.MatchID);
    console.log("/match: %s", query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/match: %s', err.toString());
                handleError(err);
            }
            else if (result.length == 0) {
                console.log('/match: %s', "Result.length == 0");
                res.send(htmlHeader + "Match not found" + htmlFooter);
            }
            else {
                var data = fs.readFile('./templates/Match.html', 'utf8',
                    function(fserr, data) {
                        if (fserr) {
                            console.log('/match: %s', fserr.toString());
                            handleError(fserr);
                        }
                        else {
                            if (+result[0].P1Score > +result[0].P2Score) {
                                data = data.replace('$p1altmod', 'Won');
                                data = data.replace('$p1imgmod', 'uparrow.png');
                                data = data.replace('$p1elochange', '+' + result[0].P1ELOChange);
                                data = data.replace('$p1colormod', 'green');
                                data = data.replace('$p2altmod', 'Lost');
                                data = data.replace('$p2imgmod', 'downarrow.png');
                                data = data.replace('$p2elochange', '-' + result[0].P2ELOChange);
                                data = data.replace('$p2colormod', 'red');
                            }
                            else {
                                data = data.replace('$p1altmod', 'Lost');
                                data = data.replace('$p1imgmod', 'downarrow.png');
                                data = data.replace('$p1elochange', '-' + result[0].P2ELOChange);
                                data = data.replace('$p1colormod', 'red');
                                data = data.replace('$p2altmod', 'Won');
                                data = data.replace('$p2imgmod', 'uparrow.png');
                                data = data.replace('$p2elochange', '+' + result[0].P2ELOChange);
                                data = data.replace('$p2colormod', 'green');
                            }
                            data = data.replace('$p1name', result[0].P1Name);
                            data = data.replace('$p2name', result[0].P2Name);
                            data = data.replace('$p1id', result[0].P1ID);
                            data = data.replace('$p2id', result[0].P2ID);
                            data = data.replace('$p1elo', result[0].P1ELO);
                            data = data.replace('$p2elo', result[0].P2ELO);
                            data = data.replace('$map', result[0].Map);
                            data = data.replace('$date', result[0].Datetime);
                            data = data.replace('$p1score', result[0].P1Score);
                            data = data.replace('$p2score', result[0].P2Score);
                            data = data.replace('$p1gkills', result[0].P1GKills);
                            data = data.replace('$p1mgkills', result[0].P1MGKills);
                            data = data.replace('$p1sgkills', result[0].P1SGKills);
                            data = data.replace('$p1rlkills', result[0].P1RLKills);
                            data = data.replace('$p1lgkills', result[0].P1LGKills);
                            data = data.replace('$p1rgkills', result[0].P1RGKills);
                            data = data.replace('$p1glkills', result[0].P1GLKills);
                            data = data.replace('$p1pgkills', result[0].P1PGKills);
                            data = data.replace('$p1bfgkills', result[0].P1BFGKills);
                            data = data.replace('$p1telekills', result[0].P1TFKills);
                            data = data.replace('$p1mghits', result[0].P1MGHits);
                            data = data.replace('$p1mgshots', result[0].P1MGShots);
                            var p1mgacc = result[0].P1MGShots > 0 ? (result[0].P1MGHits/result[0].P1MGShots)*100 : 0;
                            data = data.replace('$p1mgacc', p1mgacc.toFixed(2) + '%');
                            data = data.replace('$p1sghits', result[0].P1SGHits);
                            data = data.replace('$p1sgshots', result[0].P1SGShots);
                            var p1sgacc = result[0].P1SGShots > 0 ? (result[0].P1SGHits/result[0].P1SGShots)*100 : 0;
                            data = data.replace('$p1sgacc', p1sgacc.toFixed(2) + '%');
                            data = data.replace('$p1rlhits', result[0].P1RLHits);
                            data = data.replace('$p1rlshots', result[0].P1RLShots);
                            var p1rlacc = result[0].P1RLShots > 0 ? (result[0].P1RLHits/result[0].P1RLShots)*100 : 0;
                            data = data.replace('$p1rlacc', p1rlacc.toFixed(2) + '%');
                            data = data.replace('$p1lghits', result[0].P1LGHits);
                            data = data.replace('$p1lgshots', result[0].P1LGShots);
                            var p1lgacc = result[0].P1LGShots > 0 ? (result[0].P1LGHits/result[0].P1LGShots)*100 : 0;
                            data = data.replace('$p1lgacc', p1lgacc.toFixed(2) + '%');
                            data = data.replace('$p1rghits', result[0].P1RGHits);
                            data = data.replace('$p1rgshots', result[0].P1RGShots);
                            var p1rgacc = result[0].P1RGShots > 0 ? (result[0].P1RGHits/result[0].P1RGShots)*100 : 0;
                            data = data.replace('$p1rgacc', p1rgacc.toFixed(2) + '%');
                            data = data.replace('$p1glhits', result[0].P1GLHits);
                            data = data.replace('$p1glshots', result[0].P1GLShots);
                            var p1glacc = result[0].P1GLShots > 0 ? (result[0].P1GLHits/result[0].P1GLShots)*100 : 0;
                            data = data.replace('$p1glacc', p1glacc.toFixed(2) + '%');
                            data = data.replace('$p1pghits', result[0].P1PGHits);
                            data = data.replace('$p1pgshots', result[0].P1PGShots);
                            var p1pgacc = result[0].P1PGShots > 0 ? (result[0].P1PGHits/result[0].P1PGShots)*100 : 0;
                            data = data.replace('$p1pgacc', p1pgacc.toFixed(2) + '%');
                            data = data.replace('$p1bfghits', result[0].P1BFGHits);
                            data = data.replace('$p1bfgshots', result[0].P1BFGShots);
                            var p1bfgacc = result[0].P1BFGShots > 0 ? (result[0].P1BFGHits/result[0].P1BFGShots)*100 : 0;
                            data = data.replace('$p1bfgacc', p1bfgacc.toFixed(2) + '%');
                            var efficiency = result[0].P1DamageTaken > 0 ? (result[0].P1DamageGiven/result[0].P1DamageTaken)*100 : 0;
                            data = data.replace('$p1efficiency', efficiency.toFixed(2) + '%');
                            data = data.replace('$p1damage', result[0].P1DamageGiven);

                            data = data.replace('$p2gkills', result[0].P2GKills);
                            data = data.replace('$p2mgkills', result[0].P2MGKills);
                            data = data.replace('$p2sgkills', result[0].P2SGKills);
                            data = data.replace('$p2rlkills', result[0].P2RLKills);
                            data = data.replace('$p2lgkills', result[0].P2LGKills);
                            data = data.replace('$p2rgkills', result[0].P2RGKills);
                            data = data.replace('$p2glkills', result[0].P2GLKills);
                            data = data.replace('$p2pgkills', result[0].P2PGKills);
                            data = data.replace('$p2bfgkills', result[0].P2BFGKills);
                            data = data.replace('$p2telekills', result[0].P2TFKills);
                            data = data.replace('$p2mghits', result[0].P2MGHits);
                            data = data.replace('$p2mgshots', result[0].P2MGShots);
                            var p2mgacc = result[0].P2MGShots > 0 ? (result[0].P2MGHits/result[0].P2MGShots)*100 : 0;
                            data = data.replace('$p2mgacc', p2mgacc.toFixed(2) + '%');
                            data = data.replace('$p2sghits', result[0].P2SGHits);
                            data = data.replace('$p2sgshots', result[0].P2SGShots);
                            var p2sgacc = result[0].P2SGShots > 0 ? (result[0].P2SGHits/result[0].P2SGShots)*100 : 0;
                            data = data.replace('$p2sgacc', p2sgacc.toFixed(2) + '%');
                            data = data.replace('$p2rlhits', result[0].P2RLHits);
                            data = data.replace('$p2rlshots', result[0].P2RLShots);
                            var p2rlacc = result[0].P2RLShots > 0 ? (result[0].P2RLHits/result[0].P2RLShots)*100 : 0;
                            data = data.replace('$p2rlacc', p2rlacc.toFixed(2) + '%');
                            data = data.replace('$p2lghits', result[0].P2LGHits);
                            data = data.replace('$p2lgshots', result[0].P2LGShots);
                            var p2lgacc = result[0].P2LGShots > 0 ? (result[0].P2LGHits/result[0].P2LGShots)*100 : 0;
                            data = data.replace('$p2lgacc', p2lgacc.toFixed(2) + '%');
                            data = data.replace('$p2rghits', result[0].P2RGHits);
                            data = data.replace('$p2rgshots', result[0].P2RGShots);
                            var p2rgacc = result[0].P2RGShots > 0 ? (result[0].P2RGHits/result[0].P2RGShots)*100 : 0;
                            data = data.replace('$p2rgacc', p2rgacc.toFixed(2) + '%');
                            data = data.replace('$p2glhits', result[0].P2GLHits);
                            data = data.replace('$p2glshots', result[0].P2GLShots);
                            var p2glacc = result[0].P2GLShots > 0 ? (result[0].P2GLHits/result[0].P2GLShots)*100 : 0;
                            data = data.replace('$p2glacc', p2glacc.toFixed(2) + '%');
                            data = data.replace('$p2pghits', result[0].P2PGHits);
                            data = data.replace('$p2pgshots', result[0].P2PGShots);
                            var p2pgacc = result[0].P2PGShots > 0 ? (result[0].P2PGHits/result[0].P2PGShots)*100 : 0;
                            data = data.replace('$p2pgacc', p2pgacc.toFixed(2) + '%');
                            data = data.replace('$p2bfghits', result[0].P2BFGHits);
                            data = data.replace('$p2bfgshots', result[0].P2BFGShots);
                            var p2bfgacc = result[0].P2BFGShots > 0 ? (result[0].P2BFGHits/result[0].P2BFGShots)*100 : 0;
                            data = data.replace('$p2bfgacc', p2bfgacc.toFixed(2) + '%');
                            var efficiency = result[0].P2DamageTaken > 0 ? (result[0].P2DamageGiven/result[0].P2DamageTaken)*100 : 0;
                            data = data.replace('$p2efficiency', efficiency.toFixed(2) + '%');
                            data = data.replace('$p2damage', result[0].P2DamageGiven);
                            data = data.replace('$p1mhpickups', result[0].P1MHPickups);
                            data = data.replace('$p2mhpickups', result[0].P2MHPickups);
                            data = data.replace('$p1rapickups', result[0].P1RAPickups);
                            data = data.replace('$p2rapickups', result[0].P2RAPickups);
                            data = data.replace('$p1yapickups', result[0].P1YAPickups);
                            data = data.replace('$p2yapickups', result[0].P2YAPickups);
                            data = data.replace('$p1gapickups', result[0].P1GAPickups);
                            data = data.replace('$p2gapickups', result[0].P2GAPickups);
                            res.send(data);
                        }
                    })
            }
        });
});

// Top 100 Page
app.get('/top100', function(req, res) {
    var query = 'SELECT DISTINCT p.PlayerID, p.Name, p.ELO, COUNT(m.MatchID) as GamesPlayed, '
                  + 'SUM(CASE WHEN p.PlayerID=dm.Winner THEN 1 ELSE 0 END) as GamesWon, '
                  + 'SUM(CASE WHEN p.PlayerID!=dm.Winner THEN 1 ELSE 0 END) as GamesLost '
                  + 'FROM Players p '
                  + 'INNER JOIN PlayersMatches pm '
                  + 'ON p.PlayerID = pm.PlayerID '
                  + 'INNER JOIN Matches m '
                  + 'ON pm.MatchID = m.MatchID '
                  + 'INNER JOIN DuelMatchStats dm '
                  + 'ON m.MatchID = dm.MatchID '
                  + 'GROUP BY p.PlayerID '
                  + 'ORDER BY p.ELO DESC '
                  + 'LIMIT 100';
    console.log("/: %s", query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log("/: %s", err.toString());
                handleError(res, err);
            }
            else {
                fs.readFile('./templates/Top100.html', 'utf8',
                function (fserr, data) {
                    if (fserr) {
                        console.log("/: %s", fserr.toString());
                        handleError(res, fserr);
                    }
                    else {
                        for (var i=0; i<result.length; i++) {
                            var row = generateTopRow(result[i].PlayerID, result[i].Name, result[i].ELO, result[i].GamesPlayed, result[i].GamesWon, result[i].GamesLost);
                            data = data.replace('$toprow', row + '$toprow');
                        }

                        data = data.replace('$toprow', '');
                        res.send(data);
                    }
                });
            }
        });
});

// Latest Matches Page
app.get('/latestmatches', function(req, res) {
    var query = 'SELECT DISTINCT p1.PlayerID as P1ID, p1.Name as P1Name, p1s.Score  as P1Score, p2.PlayerID as P2ID, '
    + 'p2.Name as P2Name, p2s.Score as P2Score, m.Map, m.Datetime, m.MatchID FROM Players p1 INNER JOIN PlayersMatches pm '
    + 'ON p1.PlayerID = pm.PlayerID INNER JOIN Matches m ON pm.MatchID = m.MatchID INNER JOIN DuelMatchStats dm ON m.MatchID '
    + '= dm.MatchID INNER JOIN PlayerStats p1s ON dm.Player1StatsID = p1s.PlayerStatsID INNER JOIN Players p2 ON dm.Player2ID '
    + '= p2.PlayerID INNER JOIN PlayerStats p2s ON dm.Player2StatsID = p2s.PlayerStatsID WHERE p1.PlayerID != p2.PlayerID '
    + 'ORDER BY m.Datetime DESC LIMIT 100';

    console.log("/: %s", query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log("/: %s", err.toString());
                handleError(res, err);
            }
            else {
            fs.readFile('./templates/LatestMatches.html', 'utf8',
                function (fserr, data) {
                    if (fserr) {
                        console.log("/: %s", fserr.toString());
                        handleError(res, fserr);
                    }
                    else {

                        for (var j=0; j<result.length; j++) {
                            var row;
                            if (result[j].P1Score > result[j].P2Score) {
                                row = generateRecentRow(result[j].P1ID, result[j].P1Name, result[j].P1Score,
                                           result[j].P2Score, result[j].P2ID, result[j].P2Name, result[j].Map,
                                           result[j].MatchID, result[j].Datetime);
                            }
                            else {
                                row = generateRecentRow(result[j].P2ID, result[j].P2Name, result[j].P2Score,
                                           result[j].P1Score, result[j].P1ID, result[j].P1Name, result[j].Map,
                                           result[j].MatchID, result[j].Datetime);
                            }
                            data = data.replace('$recentrow', row + '$recentrow');
                        }

                        data = data.replace('$recentrow', '');
                        res.send(data);
                    }
                });
            }
        });
});

// Project 1 Requirements Page
app.get('/projectrequirements', function (req, res) {
    var data = fs.readFile('./templates/ProjectRequirements.html', 'utf8',
        function (fserr, data) {
            if (fserr) {
                console.log('/projectrequirements: %s', fserr.toString());
                handleError(res, fserr);
            }
            else {
                res.send(data);
            }
        });
});
// Match Update Page
app.get('/api/updatematch', function (req, res) {
    var query = 'SELECT p1.PlayerID as P1ID, p1.Name as P1Name, p1s.Score '
              + 'as P1Score, p2.PlayerID as P2ID, p2.Name as P2Name, p2s.Score as P2Score, m.Map, m.Datetime, m.MatchID '
              + 'FROM Players p1 '
              + 'INNER JOIN PlayersMatches pm '
              + 'ON p1.PlayerID = pm.PlayerID '
              + 'INNER JOIN Matches m '
              + 'ON pm.MatchID = m.MatchID '
              + 'INNER JOIN DuelMatchStats dm '
              + 'ON m.MatchID = dm.MatchID '
              + 'INNER JOIN PlayerStats p1s '
              + 'ON dm.Player1StatsID = p1s.PlayerStatsID '
              + 'INNER JOIN Players p2 '
              + 'ON dm.Player2ID = p2.PlayerID '
              + 'INNER JOIN PlayerStats p2s '
              + 'ON dm.Player2StatsID = p2s.PlayerStatsID '
              + 'WHERE p1.PlayerID != p2.PlayerID '
              + 'ORDER BY m.Datetime DESC';
    console.log('/api/updatematch: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/updatematch: %s', err.toString());
                handleError(res, err);
            }
            else {
                var responseHTML = '<h1>Select Match</h1>'
                    + '<form method="GET" action=/api/updatematch/edit>'
                    + 'Match: <select name="MatchID" id="MatchID">';
                for (var i=0; i<result.length; i++) {
                    responseHTML += '<option value="' + result[i].MatchID + '">'
                    + result[i].P1Name + ' (' + result[i].P1Score + ')'  + ' vs ' + '(' + result[i].P2Score + ') ' + result[i].P2Name + ' on ' + result[i].Map + ', ' + result[i].Datetime
                    + '</option>';
                }
                responseHTML += '</select>'
                + '&nbsp;<input type="submit">'
                + '</form>';

                res.send(htmlHeader + responseHTML + htmlFooter);
            }
        });
});

// Match Update Submit Page
app.get('/api/updatematch/edit', function(req,res) {
    var query = 'SELECT m.MatchID, m.Datetime, m.Map, dm.Winner, p1.PlayerID as P1ID, p1.Name as P1Name, dm.P1ELOChange, dm.P2ELOChange, p1.ELO as P1ELO, p2.ELO as P2ELO, '
              + 'p1s.Score as P1Score, p1s.Suicides as P1Suicides, p1s.Deaths as P1Deaths, p1s.Kills as P1Kills, p1s.Net as P1Net, '
              + 'p1s.PlayerStatsID as P1PlayerStats, p1w.WeaponStatsID as P1WeaponStats, p1t.ItemStatsID as P1ItemStats, '
              + 'p1s.DamageGiven as P1DamageGiven, p1s.DamageTaken as P1DamageTaken, p1s.HealthTotal as P1HealthTotal, p1s.ArmorTotal as P1ArmorTotal, '
              + 'p1w.GKills as P1GKills, '
              + 'p1w.MGKills as P1MGKills, p1w.MGShots as P1MGShots, p1w.MGHits as P1MGHits, '
              + 'p1w.SGKills as P1SGKills, p1w.SGShots as P1SGShots, p1w.SGHits as P1SGHits, '
              + 'p1w.PGKills as P1PGKills, p1w.PGShots as P1PGShots, p1w.PGHits as P1PGHits, '
              + 'p1w.RLKills as P1RLKills, p1w.RLShots as P1RLShots, p1w.RLHits as P1RLHits, '
              + 'p1w.LGKills as P1LGKills, p1w.LGShots as P1LGShots, p1w.LGHits as P1LGHits, '
              + 'p1w.RGKills as P1RGKills, p1w.RGShots as P1RGShots, p1w.RGHits as P1RGHits, '
              + 'p1w.BFGKills as P1BFGKills, p1w.BFGShots as P1BFGShots, p1w.BFGHits as P1BFGHits, '
              + 'p1w.GLKills as P1GLKills, p1w.GLShots as P1GLShots, p1w.GLHits as P1GLHits, '
              + 'p1w.TFKills as P1TFKills, '
              + 'p1t.MHPickups as P1MHPickups, p1t.RAPickups as P1RAPickups, p1t.YAPickups as P1YAPickups, p1t.GAPickups as P1GAPickups, '
              + 'p2.PlayerID as P2ID, p2.Name as P2Name, '
              + 'p2s.Score as P2Score, p2s.Suicides as P2Suicides, p2s.Deaths as P2Deaths, p2s.Kills as P2Kills, p2s.Net as P2Net, '
              + 'p2s.PlayerStatsID as P2PlayerStats, p2w.WeaponStatsID as P2WeaponStats, p2t.ItemStatsID as P2ItemStats, '
              + 'p2s.DamageGiven as P2DamageGiven, p2s.DamageTaken as P2DamageTaken, p2s.HealthTotal as P2HealthTotal, p2s.ArmorTotal as P2ArmorTotal, '
              + 'p2w.GKills as P2GKills, '
              + 'p2w.MGKills as P2MGKills, p2w.MGShots as P2MGShots, p2w.MGHits as P2MGHits, '
              + 'p2w.SGKills as P2SGKills, p2w.SGShots as P2SGShots, p2w.SGHits as P2SGHits, '
              + 'p2w.PGKills as P2PGKills, p2w.PGShots as P2PGShots, p2w.PGHits as P2PGHits, '
              + 'p2w.RLKills as P2RLKills, p2w.RLShots as P2RLShots, p2w.RLHits as P2RLHits, '
              + 'p2w.LGKills as P2LGKills, p2w.LGShots as P2LGShots, p2w.LGHits as P2LGHits, '
              + 'p2w.RGKills as P2RGKills, p2w.RGShots as P2RGShots, p2w.RGHits as P2RGHits, '
              + 'p2w.BFGKills as P2BFGKills, p2w.BFGShots as P2BFGShots, p2w.BFGHits as P2BFGHits, '
              + 'p2w.GLKills as P2GLKills, p2w.GLShots as P2GLShots, p2w.GLHits as P2GLHits, '
              + 'p2w.TFKills as P2TFKills, '
              + 'p2t.MHPickups as P2MHPickups, p2t.RAPickups as P2RAPickups, p2t.YAPickups as P2YAPickups, p2t.GAPickups as P2GAPickups '
              + 'FROM Matches m '
              + 'INNER JOIN DuelMatchStats dm '
              + 'ON m.MatchID = dm.MatchID '
              + 'INNER JOIN PlayerStats p1s '
              + 'ON dm.Player1StatsID = p1s.PlayerStatsID '
              + 'INNER JOIN PlayerStats p2s '
              + 'ON dm.Player2StatsID = p2s.PlayerStatsID '
              + 'INNER JOIN WeaponStats p1w '
              + 'ON dm.Player1WeaponsID = p1w.WeaponStatsID '
              + 'INNER JOIN WeaponStats p2w '
              + 'ON dm.Player2WeaponsID = p2w.WeaponStatsID '
              + 'INNER JOIN Players p1 '
              + 'ON p1.PlayerID = dm.Player1ID '
              + 'INNER JOIN Players p2 '
              + 'ON p2.PlayerID = dm.Player2ID '
              + 'INNER JOIN ItemStats p1t '
              + 'ON dm.Player1ItemsID = p1t.ItemStatsID '
              + 'INNER JOIN ItemStats p2t '
              + 'ON dm.Player2ItemsID = p2t.ItemStatsID '
              + 'WHERE m.MatchID=' + connection.escape(req.query.MatchID);
    console.log('/api/updatematch/edit: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/updatematch/edit: %s', err.toString());
                handleError(res, err);
            }
            else if (result.length == 0) {
                console.log('/api/updatematch/edit: %s', "Match not found");
                res.send(htmlHeader + "Match not found" + htmlFooter);
            }
            else {
                var responseHTML = '<form method="POST" action=/api/updatematch/submit>' +
                       '</select>' +
                       '<h1>Match Information</h1>' +
                       'Date: 	<input type="text" name="Datetime" id="Datetime" value="' + result[0].Datetime + '" /><br />' +
                       'Map: 	<input type="text" name="Map" id="Map" value="' + result[0].Map + '" /><br />' +
                       '<h1>Player 1 Information</h1>' +
                       'Score: 	<input type="text" name="P1Score" id="P1Score" value="' + result[0].P1Score + '" /><br />' +
                       'Kills: 	<input type="text" name="P1Kills" id="P1Kills" value="' + result[0].P1Kills + '" /><br />' +
                       'Deaths: 	<input type="text" name="P1Deaths" id="P1Deaths" value="' + result[0].P1Deaths + '" /><br />' +
                       'Suicides: 	<input type="text" name="P1Suicides" id="P1Suicides" value="' + result[0].P1Suicides + '" /><br />' +
                       'Net: 	<input type="text" name="P1Net" id="P1Net" value="' + result[0].P1Net + '" /><br />' +
                       'DamageGiven: 	<input type="text" name="P1DamageGiven" id="P1DamageGiven" value="' + result[0].P1DamageGiven + '" /><br />' +
                       'DamageTaken: 	<input type="text" name="P1DamageTaken" id="P1DamageTaken" value="' + result[0].P1DamageTaken + '" /><br />' +
                       'HealthTotal: 	<input type="text" name="P1HealthTotal" id="P1HealthTotal" value="' + result[0].P1HealthTotal + '" /><br />' +
                       'ArmorTotal: 	<input type="text" name="P1ArmorTotal" id="P1ArmorTotal" value="' + result[0].P1ArmorTotal + '" /><br />' +
                       'MHPickups: 	<input type="text" name="P1MHPickups" id="P1MHPickups" value="' + result[0].P1MHPickups + '" /><br />' +
                       'RAPickups: 	<input type="text" name="P1RAPickups" id="P1RAPickups" value="' + result[0].P1RAPickups + '" /><br />' +
                       'YAPickups: 	<input type="text" name="P1YAPickups" id="P1YAPickups" value="' + result[0].P1YAPickups + '" /><br />' +
                       'GAPickups: 	<input type="text" name="P1GAPickups" id="P1GAPickups" value="' + result[0].P1GAPickups + '" /><br />' +
                       'GKills: 	<input type="text" name="P1GKills" id="P1GKills" value="' + result[0].P1GKills + '" /><br />' +
                       'MGKills: 	<input type="text" name="P1MGKills" id="P1MGKills" value="' + result[0].P1MGKills + '" /><br />' +
                       'MGShots: 	<input type="text" name="P1MGShots" id="P1MGShots" value="' + result[0].P1MGShots + '" /><br />' +
                       'MGHits: 	<input type="text" name="P1MGHits" id="P1MGHits" value="' + result[0].P1MGHits + '" /><br />' +
                       'SGKills: 	<input type="text" name="P1SGKills" id="P1SGKills" value="' + result[0].P1SGKills + '" /><br />' +
                       'SGShots: 	<input type="text" name="P1SGShots" id="P1SGShots" value="' + result[0].P1SGShots + '" /><br />' +
                       'SGHits: 	<input type="text" name="P1SGHits" id="P1SGHits" value="' + result[0].P1SGHits + '" /><br />' +
                       'PGKills: 	<input type="text" name="P1PGKills" id="P1PGKills" value="' + result[0].P1PGKills + '" /><br />' +
                       'PGShots: 	<input type="text" name="P1PGShots" id="P1PGShots" value="' + result[0].P1PGShots + '" /><br />' +
                       'PGHits: 	<input type="text" name="P1PGHits" id="P1PGHits" value="' + result[0].P1PGHits + '" /><br />' +
                       'RLKills: 	<input type="text" name="P1RLKills" id="P1RLKills" value="' + result[0].P1RLKills + '" /><br />' +
                       'RLShots: 	<input type="text" name="P1RLShots" id="P1RLShots" value="' + result[0].P1RLShots + '" /><br />' +
                       'RLHits: 	<input type="text" name="P1RLHits" id="P1RLHits" value="' + result[0].P1RLHits + '" /><br />' +
                       'LGKills: 	<input type="text" name="P1LGKills" id="P1LGKills" value="' + result[0].P1LGKills + '" /><br />' +
                       'LGShots: 	<input type="text" name="P1LGShots" id="P1LGShots" value="' + result[0].P1LGShots + '" /><br />' +
                       'LGHits: 	<input type="text" name="P1LGHits" id="P1LGHits" value="' + result[0].P1LGHits + '" /><br />' +
                       'RGKills: 	<input type="text" name="P1RGKills" id="P1RGKills" value="' + result[0].P1RGKills + '" /><br />' +
                       'RGShots: 	<input type="text" name="P1RGShots" id="P1RGShots" value="' + result[0].P1RGShots + '" /><br />' +
                       'RGHits: 	<input type="text" name="P1RGHits" id="P1RGHits1" value="' + result[0].P1RGHits + '" /><br />' +
                       'BFGKills: 	<input type="text" name="P1BFGKills" id="P1BFGKills" value="' + result[0].P1BFGKills + '" /><br />' +
                       'BFGShots: 	<input type="text" name="P1BFGShots" id="P1BFGShots" value="' + result[0].P1BFGShots + '" /><br />' +
                       'BFGHits: 	<input type="text" name="P1BFGHits" id="P1BFGHits" value="' + result[0].P1BFGHits + '" /><br />' +
                       'GLKills: 	<input type="text" name="P1GLKills" id="P1GLKills" value="' + result[0].P1GLKills + '" /><br />' +
                       'GLShots: 	<input type="text" name="P1GLShots" id="P1GLShots" value="' + result[0].P1GLShots + '" /><br />' +
                       'GLHits: 	<input type="text" name="P1GLHits" id="P1GLHits" value="' + result[0].P1GLHits + '" /><br />' +
                       'TFKills: 	<input type="text" name="P1TFKills" id="P1TFKills" value="' + result[0].P1TFKills + '" /><br />' +
                       '<h1>Player 2 Information</h1>' +
                       'Score: 	<input type="text" name="P2Score" id="P2Score" value="' + result[0].P2Score + '" /><br />' +
                       'Kills: 	<input type="text" name="P2Kills" id="P2Kills" value="' + result[0].P2Kills + '" /><br />' +
                       'Deaths: 	<input type="text" name="P2Deaths" id="P2Deaths" value="' + result[0].P2Deaths + '" /><br />' +
                       'Suicides: 	<input type="text" name="P2Suicides" id="P2Suicides" value="' + result[0].P2Suicides + '" /><br />' +
                       'Net: 	<input type="text" name="P2Net" id="P2Net" value="' + result[0].P2Net + '" /><br />' +
                       'DamageGiven: 	<input type="text" name="P2DamageGiven" id="P2DamageGiven" value="' + result[0].P2DamageGiven + '" /><br />' +
                       'DamageTaken: 	<input type="text" name="P2DamageTaken" id="P2DamageTaken" value="' + result[0].P2DamageTaken + '" /><br />' +
                       'HealthTotal: 	<input type="text" name="P2HealthTotal" id="P2HealthTotal" value="' + result[0].P2HealthTotal + '" /><br />' +
                       'ArmorTotal: 	<input type="text" name="P2ArmorTotal" id="P2ArmorTotal" value="' + result[0].P2ArmorTotal + '" /><br />' +
                       'MHPickups: 	<input type="text" name="P2MHPickups" id="P2MHPickups" value="' + result[0].P2MHPickups + '" /><br />' +
                       'RAPickups: 	<input type="text" name="P2RAPickups" id="P2RAPickups" value="' + result[0].P2RAPickups + '" /><br />' +
                       'YAPickups: 	<input type="text" name="P2YAPickups" id="P2YAPickups" value="' + result[0].P2YAPickups + '" /><br />' +
                       'GAPickups: 	<input type="text" name="P2GAPickups" id="P2GAPickups" value="' + result[0].P2GAPickups + '" /><br />' +
                       'GKills: 	<input type="text" name="P2GKills" id="P2GKills" value="' + result[0].P2GKills + '" /><br />' +
                       'MGKills: 	<input type="text" name="P2MGKills" id="P2MGKills" value="' + result[0].P2MGKills + '" /><br />' +
                       'MGShots: 	<input type="text" name="P2MGShots" id="P2MGShots" value="' + result[0].P2MGShots + '" /><br />' +
                       'MGHits: 	<input type="text" name="P2MGHits" id="P2MGHits" value="' + result[0].P2MGHits + '" /><br />' +
                       'SGKills: 	<input type="text" name="P2SGKills" id="P2SGKills" value="' + result[0].P2SGKills + '" /><br />' +
                       'SGShots: 	<input type="text" name="P2SGShots" id="P2SGShots" value="' + result[0].P2SGShots + '" /><br />' +
                       'SGHits: 	<input type="text" name="P2SGHits" id="P2SGHits" value="' + result[0].P2SGHits + '" /><br />' +
                       'PGKills: 	<input type="text" name="P2PGKills" id="P2PGKills" value="' + result[0].P2PGKills + '" /><br />' +
                       'PGShots: 	<input type="text" name="P2PGShots" id="P2PGShots" value="' + result[0].P2PGShots + '" /><br />' +
                       'PGHits: 	<input type="text" name="P2PGHits" id="P2PGHits" value="' + result[0].P2PGHits + '" /><br />' +
                       'RLKills: 	<input type="text" name="P2RLKills" id="P2RLKills" value="' + result[0].P2RLKills + '" /><br />' +
                       'RLShots: 	<input type="text" name="P2RLShots" id="P2RLShots" value="' + result[0].P2RLShots + '" /><br />' +
                       'RLHits: 	<input type="text" name="P2RLHits" id="P2RLHits" value="' + result[0].P2RLHits + '" /><br />' +
                       'LGKills: 	<input type="text" name="P2LGKills" id="P2LGKills" value="' + result[0].P2LGKills + '" /><br />' +
                       'LGShots: 	<input type="text" name="P2LGShots" id="P2LGShots" value="' + result[0].P2LGShots + '" /><br />' +
                       'LGHits: 	<input type="text" name="P2LGHits" id="P2LGHits" value="' + result[0].P2LGHits + '" /><br />' +
                       'RGKills: 	<input type="text" name="P2RGKills" id="P2RGKills" value="' + result[0].P2RGKills + '" /><br />' +
                       'RGShots: 	<input type="text" name="P2RGShots" id="P2RGShots" value="' + result[0].P2RGShots + '" /><br />' +
                       'RGHits: 	<input type="text" name="P2RGHits" id="P2RGHits1" value="' + result[0].P2RGHits + '" /><br />' +
                       'BFGKills: 	<input type="text" name="P2BFGKills" id="P2BFGKills" value="' + result[0].P2BFGKills + '" /><br />' +
                       'BFGShots: 	<input type="text" name="P2BFGShots" id="P2BFGShots" value="' + result[0].P2BFGShots + '" /><br />' +
                       'BFGHits: 	<input type="text" name="P2BFGHits" id="P2BFGHits" value="' + result[0].P2BFGHits + '" /><br />' +
                       'GLKills: 	<input type="text" name="P2GLKills" id="P2GLKills" value="' + result[0].P2GLKills + '" /><br />' +
                       'GLShots: 	<input type="text" name="P2GLShots" id="P2GLShots" value="' + result[0].P2GLShots + '" /><br />' +
                       'GLHits: 	<input type="text" name="P2GLHits" id="P2GLHits" value="' + result[0].P2GLHits + '" /><br />' +
                       'TFKills: 	<input type="text" name="P2TFKills" id="P2TFKills" value="' + result[0].P2TFKills + '" /><br />' +
                       '<input type="hidden" name="MatchID" id="MatchID" value="'            + result[0].MatchID + '" />' +
                       '<input type="hidden" name="P1ID" id="P1ID" value="'            + result[0].P1ID + '" />' +
                       '<input type="hidden" name="P1PlayerStats" id=P1PlayerStats value="'        + result[0].P1PlayerStats + '" />' +
                       '<input type="hidden" name="P1WeaponStats" id=P1WeaponStats value="'        + result[0].P1WeaponStats + '" />' +
                       '<input type="hidden" name="P1ItemStats" id=P1ItemStats value="'            + result[0].P1ItemStats + '" />' +
                       '<input type="hidden" name="P2ID" id="P2ID" value="'            + result[0].P2ID + '" />' +
                       '<input type="hidden" name="P2PlayerStats" id=P2PlayerStats value="'        + result[0].P2PlayerStats + '" />' +
                       '<input type="hidden" name="P2WeaponStats" id=P2WeaponStats value="'        + result[0].P2WeaponStats + '" />' +
                       '<input type="hidden" name="P2ItemStats" id=P2ItemStats value="'            + result[0].P2ItemStats + '" />' +
                       '<input type="submit" />' +
                       '</form>';

                       res.send(htmlHeader + responseHTML + htmlFooter);
            }
        });

});

// Match Update Submit Page
app.post('/api/updatematch/submit', function(req,res) {
    var query = 'UPDATE Matches m, PlayerStats p1s, ItemStats p1t, WeaponStats p1w, PlayerStats p2s, ItemStats p2t, WeaponStats p2w '
              + 'SET m.Datetime=' + connection.escape(req.body.Datetime) + ', m.Map=' + connection.escape(req.body.Map) + ', '
              + 'p1s.Score=' + connection.escape(req.body.P1Score) + ', p1s.Kills=' + connection.escape(req.body.P1Kills) + ', p1s.Deaths='
              + connection.escape(req.body.P1Deaths) + ', p1s.Suicides=' + connection.escape(req.body.P1Suicides) + ', p1s.Net='
              + connection.escape(req.body.P1Net) + ', p1s.DamageGiven=' + connection.escape(req.body.P1DamageGiven) + ', p1s.DamageTaken='
              + connection.escape(req.body.P1DamageTaken) + ', '
              + 'p1s.HealthTotal=' + connection.escape(req.body.P1HealthTotal) + ', p1s.ArmorTotal=' + connection.escape(req.body.P1ArmorTotal)
              + ', p1t.MHPickups=' + connection.escape(req.body.P1MHPickups) + ', p1t.RAPickups=' + connection.escape(req.body.P1RAPickups)
              + ', p1t.YAPickups=' + connection.escape(req.body.P1YAPickups) + ', p1t.GAPickups=' + connection.escape(req.body.P1GAPickups) + ', '
              + 'p1w.GKills=' + connection.escape(req.body.P1GKills) + ', p1w.MGKills=' + connection.escape(req.body.P1MGKills) + ', p1w.MGShots='
              + connection.escape(req.body.P1MGShots) + ', p1w.MGHits=' + connection.escape(req.body.P1MGHits) + ', p1w.SGKills='
              + connection.escape(req.body.P1SGKills) + ', p1w.SGShots=' + connection.escape(req.body.P1SGShots) + ', p1w.SGHits='
              + connection.escape(req.body.P1SGHits) + ', '
              + 'p1w.PGKills=' + connection.escape(req.body.P1PGKills) + ', p1w.PGShots=' + connection.escape(req.body.P1PGSHots) + ', p1w.PGHits='
              + connection.escape(req.body.P1PGHits) + ', p1w.RLKills=' + connection.escape(req.body.P1RLKills) + ', p1w.RLShots='
              + connection.escape(req.body.P1RLShots) + ', p1w.RLHits=' + connection.escape(req.body.P1RLHits) + ', p1w.LGKills=' + connection.escape(req.body.P1LGKills) + ', '
              + 'p1w.LGShots=' + connection.escape(req.body.P1LGShots) + ', p1w.LGHits=' + connection.escape(req.body.P1LGHits) + ', p1w.RGKills='
              + connection.escape(req.body.P1RGKills) + ', p1w.RGShots=' + connection.escape(req.body.P1RGShots) + ', p1w.RGHits='
              + connection.escape(req.body.P1RGHits) + ', p1w.BFGKills=' + connection.escape(req.body.P1BFGKills) + ', p1w.BFGShots=' + connection.escape(req.body.P1BFGShots) + ', '
              + 'p1w.BFGHits=' + connection.escape(req.body.P1BFGHits) + ', p1w.GLKills=' + connection.escape(req.body.P1GLKills)
              + ', p1w.GLShots=' + connection.escape(req.body.P1GLShots) + ', p1w.GLHits=' + connection.escape(req.body.P1GLHits) + ', p1w.TFKills=' + connection.escape(req.body.P1TFKills) + ', '
              + 'p2s.Score=' + connection.escape(req.body.P2Score) + ', p2s.Kills=' + connection.escape(req.body.P2Kills) + ', p2s.Deaths='
              + connection.escape(req.body.P2Deaths) + ', p2s.Suicides=' + connection.escape(req.body.P2Suicides) + ', p2s.Net=' + connection.escape(req.body.P2Net)
              + ', p2s.DamageGiven=' + connection.escape(req.body.P2DamageGiven) + ', p2s.DamageTaken=' + connection.escape(req.body.P2DamageTaken) + ', '
              + 'p2s.HealthTotal=' + connection.escape(req.body.P2HealthTotal) + ', p2s.ArmorTotal=' + connection.escape(req.body.P2ArmorTotal)
              + ', p2t.MHPickups=' + connection.escape(req.body.P2MHPickups) + ', p2t.RAPickups=' + connection.escape(req.body.P2RAPickups)
              + ', p2t.YAPickups=' + connection.escape(req.body.P2YAPickups) + ', p2t.GAPickups=' + connection.escape(req.body.P2GAPickups) + ', '
              + 'p2w.GKills=' + connection.escape(req.body.P2GKills) + ', p2w.MGKills=' + connection.escape(req.body.P2MGKills) + ', p2w.MGShots='
              + connection.escape(req.body.P2MGShots) + ', p2w.MGHits=' + connection.escape(req.body.P2MGHits) + ', p2w.SGKills=' + connection.escape(req.body.P2SGKills)
              + ', p2w.SGShots=' + connection.escape(req.body.P2SGShots) + ', p2w.SGHits=' + connection.escape(req.body.P2SGHits) + ', '
              + 'p2w.PGKills=' + connection.escape(req.body.P2PGKills) + ', p2w.PGShots=' + connection.escape(req.body.P2PGShots) + ', p2w.PGHits='
              + connection.escape(req.body.P2PGHits) + ', p2w.RLKills=' + connection.escape(req.body.P2RLKills) + ', p2w.RLShots=' + connection.escape(req.body.P2RLShots)
              + ', p2w.RLHits=' + connection.escape(req.body.P2RLHits) + ', p2w.LGKills='+ connection.escape(req.body.P2LGKills) + ', '
              + 'p2w.LGShots=' + connection.escape(req.body.P2LGShots) + ', p2w.LGHits=' + connection.escape(req.body.P2LGHits) + ', p2w.RGKills='
              + connection.escape(req.body.P2RGKills) + ', p2w.RGShots=' + connection.escape(req.body.P2RGShots) + ', p2w.RGHits=' + connection.escape(req.body.P2RGHits)
              + ', p2w.BFGKills=' + connection.escape(req.body.P2BFGKills) + ', p2w.BFGShots=' + connection.escape(req.body.P2BFGShots) + ', '
              + 'p2w.BFGHits=' + connection.escape(req.body.P2BFGHits) + ', p2w.GLKills=' + connection.escape(req.body.P2GLKills) + ', p2w.GLShots='
              + connection.escape(req.body.P2GLShots) + ', p2w.GLHits=' + connection.escape(req.body.P2GLHits) + ', p2w.TFKills='+ connection.escape(req.body.TFKills) + ' '
              + 'WHERE m.MatchID=' + connection.escape(req.body.MatchID) + ' AND p1s.PlayerStatsID=' + connection.escape(req.body.P1PlayerStats) + ' AND p1t.ItemStatsID='
              + connection.escape(req.body.P1ItemStats) + ' AND p1w.WeaponStatsID=' + connection.escape(req.body.P1WeaponStats) + ' '
              + 'AND p2s.PlayerStatsID=' + connection.escape(req.body.P2PlayerStats) + ' AND p2t.ItemStatsID=' + connection.escape(req.body.P2ItemStats)
              + ' AND p2w.WeaponStatsID=' + connection.escape(req.body.P2WeaponStats);
    console.log('/api/updatematch/submit: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/updatematch/submit: %s', err.toString());
                handleError(res, err);
            }
            else {
                res.send(htmlHeader + "Match Updated" + htmlFooter);
            }
        });
});

// Match Create Page
app.get('/api/creatematch', function (req, res) {
var query = 'SELECT Name, PlayerID FROM Players';
    console.log('/api/creatematch: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/creatematch: %s', err.toString());
                handleError(res, err);
            }
            else {
                var responseHTML = '<h1>Select Players</h1>'
                    + '<form method="POST" action=/api/creatematch/submit>'
                    + 'Player1: <select name="P1ID" id="P1ID">';
                for (var i=0; i<result.length; i++) {
                    responseHTML += '<option value="' + result[i].PlayerID + '">'
                    + result[i].Name
                    + '</option>';
                }
                responseHTML += '</select><br>';
                responseHTML += 'Player2: <select name="P2ID" id="P2ID">';
                for (var i=0; i<result.length; i++) {
                    responseHTML += '<option value="' + result[i].PlayerID + '">'
                    + result[i].Name
                    + '</option>';
                }
                responseHTML += '</select>' +
                '<h1>Match Information</h1>' +
                'Date: 	<input type="text" name="Datetime" id="Datetime" value="0" /><br />' +
                'Map: 	<input type="text" name="Map" id="Map" value="0" /><br />' +
                '<h1>Player 1 Information</h1>' +
                'Score: 	<input type="text" name="Score1" id="Score1" value="0" /><br />' +
                'Kills: 	<input type="text" name="Kills1" id="Kills1" value="0" /><br />' +
                'Deaths: 	<input type="text" name="Deaths1" id="Deaths1" value="0" /><br />' +
                'Suicides: 	<input type="text" name="Suicides1" id="Suicides1" value="0" /><br />' +
                'Net: 	<input type="text" name="Net1" id="Net1" value="0" /><br />' +
                'DamageGiven: 	<input type="text" name="DamageGiven1" id="DamageGiven1" value="0" /><br />' +
                'DamageTaken: 	<input type="text" name="DamageTaken1" id="DamageTaken1" value="0" /><br />' +
                'Captures: 	<input type="text" name="Captures1" id="Captures1" value="0" /><br />' +
                'Assists: 	<input type="text" name="Assists1" id="Assists1" value="0" /><br />' +
                'Defense: 	<input type="text" name="Defense1" id="Defense1" value="0" /><br />' +
                'Returns: 	<input type="text" name="Returns1" id="Returns1" value="0" /><br />' +
                'HealthTotal: 	<input type="text" name="HealthTotal1" id="HealthTotal1" value="0" /><br />' +
                'ArmorTotal: 	<input type="text" name="ArmorTotal1" id="ArmorTotal1" value="0" /><br />' +
                'MHPickups: 	<input type="text" name="MHPickups1" id="MHPickups1" value="0" /><br />' +
                'RAPickups: 	<input type="text" name="RAPickups1" id="RAPickups1" value="0" /><br />' +
                'YAPickups: 	<input type="text" name="YAPickups1" id="YAPickups1" value="0" /><br />' +
                'GAPickups: 	<input type="text" name="GAPickups1" id="GAPickups1" value="0" /><br />' +
                'QuadPickups: 	<input type="text" name="QuadPickups1" id="QuadPickups1" value="0" /><br />' +
                'BSPickups: 	<input type="text" name="BSPickups1" id="BSPickups1" value="0" /><br />' +
                'InvisPickups: 	<input type="text" name="InvisPickups1" id="InvisPickups1" value="0" /><br />' +
                'FlightPickups: 	<input type="text" name="FlightPickups1" id="FlightPickups1" value="0" /><br />' +
                'RegenPickups: 	<input type="text" name="RegenPickups1" id="RegenPickups1" value="0" /><br />' +
                'FlagGrabs: 	<input type="text" name="FlagGrabs1" id="FlagGrabs1" value="0" /><br />' +
                'QuadTime: 	<input type="text" name="QuadTime1" id="QuadTime1" value="0" /><br />' +
                'BSTime: 	<input type="text" name="BSTime1" id="BSTime1" value="0" /><br />' +
                'InvisTime: 	<input type="text" name="InvisTime1" id="InvisTime1" value="0" /><br />' +
                'FlightTime: 	<input type="text" name="FlightTime1" id="FlightTime1" value="0" /><br />' +
                'RegenTime: 	<input type="text" name="RegenTime1" id="RegenTime1" value="0" /><br />' +
                'FlagTime: 	<input type="text" name="FlagTime1" id="FlagTime1" value="0" /><br />' +
                'GKills: 	<input type="text" name="GKills1" id="GKills1" value="0" /><br />' +
                'MGKills: 	<input type="text" name="MGKills1" id="MGKills1" value="0" /><br />' +
                'MGShots: 	<input type="text" name="MGShots1" id="MGShots1" value="0" /><br />' +
                'MGHits: 	<input type="text" name="MGHits1" id="MGHits1" value="0" /><br />' +
                'SGKills: 	<input type="text" name="SGKills1" id="SGKills1" value="0" /><br />' +
                'SGShots: 	<input type="text" name="SGShots1" id="SGShots1" value="0" /><br />' +
                'SGHits: 	<input type="text" name="SGHits1" id="SGHits1" value="0" /><br />' +
                'PGKills: 	<input type="text" name="PGKills1" id="PGKills1" value="0" /><br />' +
                'PGShots: 	<input type="text" name="PGShots1" id="PGShots1" value="0" /><br />' +
                'PGHits: 	<input type="text" name="PGHits1" id="PGHits1" value="0" /><br />' +
                'RLKills: 	<input type="text" name="RLKills1" id="RLKills1" value="0" /><br />' +
                'RLShots: 	<input type="text" name="RLShots1" id="RLShots1" value="0" /><br />' +
                'RLHits: 	<input type="text" name="RLHits1" id="RLHits1" value="0" /><br />' +
                'LGKills: 	<input type="text" name="LGKills1" id="LGKills1" value="0" /><br />' +
                'LGShots: 	<input type="text" name="LGShots1" id="LGShots1" value="0" /><br />' +
                'LGHits: 	<input type="text" name="LGHits1" id="LGHits1" value="0" /><br />' +
                'RGKills: 	<input type="text" name="RGKills1" id="RGKills1" value="0" /><br />' +
                'RGShots: 	<input type="text" name="RGShots1" id="RGShots1" value="0" /><br />' +
                'RGHits: 	<input type="text" name="RGHits1" id="RGHits1" value="0" /><br />' +
                'BFGKills: 	<input type="text" name="BFGKills1" id="BFGKills1" value="0" /><br />' +
                'BFGShots: 	<input type="text" name="BFGShots1" id="BFGShots1" value="0" /><br />' +
                'BFGHits: 	<input type="text" name="BFGHits1" id="BFGHits1" value="0" /><br />' +
                'GLKills: 	<input type="text" name="GLKills1" id="GLKills1" value="0" /><br />' +
                'GLShots: 	<input type="text" name="GLShots1" id="GLShots1" value="0" /><br />' +
                'GLHits: 	<input type="text" name="GLHits1" id="GLHits1" value="0" /><br />' +
                'TFKills: 	<input type="text" name="TFKills1" id="TFKills1" value="0" /><br />' +
                '<h1>Player 2 Information</h1>' +
                'Score: 	<input type="text" name="Score2" id="Score2" value="0" /><br />' +
                'Kills: 	<input type="text" name="Kills2" id="Kills2" value="0" /><br />' +
                'Deaths: 	<input type="text" name="Deaths2" id="Deaths2" value="0" /><br />' +
                'Suicides: 	<input type="text" name="Suicides2" id="Suicides2" value="0" /><br />' +
                'Net: 	<input type="text" name="Net2" id="Net2" value="0" /><br />' +
                'DamageGiven: 	<input type="text" name="DamageGiven2" id="DamageGiven2" value="0" /><br />' +
                'DamageTaken: 	<input type="text" name="DamageTaken2" id="DamageTaken2" value="0" /><br />' +
                'Captures: 	<input type="text" name="Captures2" id="Captures2" value="0" /><br />' +
                'Assists: 	<input type="text" name="Assists2" id="Assists2" value="0" /><br />' +
                'Defense: 	<input type="text" name="Defense2" id="Defense2" value="0" /><br />' +
                'Returns: 	<input type="text" name="Returns2" id="Returns2" value="0" /><br />' +
                'HealthTotal: 	<input type="text" name="HealthTotal2" id="HealthTotal2" value="0" /><br />' +
                'ArmorTotal: 	<input type="text" name="ArmorTotal2" id="ArmorTotal2" value="0" /><br />' +
                'MHPickups: 	<input type="text" name="MHPickups2" id="MHPickups2" value="0" /><br />' +
                'RAPickups: 	<input type="text" name="RAPickups2" id="RAPickups2" value="0" /><br />' +
                'YAPickups: 	<input type="text" name="YAPickups2" id="YAPickups2" value="0" /><br />' +
                'GAPickups: 	<input type="text" name="GAPickups2" id="GAPickups2" value="0" /><br />' +
                'QuadPickups: 	<input type="text" name="QuadPickups2" id="QuadPickups2" value="0" /><br />' +
                'BSPickups: 	<input type="text" name="BSPickups2" id="BSPickups2" value="0" /><br />' +
                'InvisPickups: 	<input type="text" name="InvisPickups2" id="InvisPickups2" value="0" /><br />' +
                'FlightPickups: 	<input type="text" name="FlightPickups2" id="FlightPickups2" value="0" /><br />' +
                'RegenPickups: 	<input type="text" name="RegenPickups2" id="RegenPickups2" value="0" /><br />' +
                'FlagGrabs: 	<input type="text" name="FlagGrabs2" id="FlagGrabs2" value="0" /><br />' +
                'QuadTime: 	<input type="text" name="QuadTime2" id="QuadTime2" value="0" /><br />' +
                'BSTime: 	<input type="text" name="BSTime2" id="BSTime2" value="0" /><br />' +
                'InvisTime: 	<input type="text" name="InvisTime2" id="InvisTime2" value="0" /><br />' +
                'FlightTime: 	<input type="text" name="FlightTime2" id="FlightTime2" value="0" /><br />' +
                'RegenTime: 	<input type="text" name="RegenTime2" id="RegenTime2" value="0" /><br />' +
                'FlagTime: 	<input type="text" name="FlagTime2" id="FlagTime2" value="0" /><br />' +
                'GKills: 	<input type="text" name="GKills2" id="GKills2" value="0" /><br />' +
                'MGKills: 	<input type="text" name="MGKills2" id="MGKills2" value="0" /><br />' +
                'MGShots: 	<input type="text" name="MGShots2" id="MGShots2" value="0" /><br />' +
                'MGHits: 	<input type="text" name="MGHits2" id="MGHits2" value="0" /><br />' +
                'SGKills: 	<input type="text" name="SGKills2" id="SGKills2" value="0" /><br />' +
                'SGShots: 	<input type="text" name="SGShots2" id="SGShots2" value="0" /><br />' +
                'SGHits: 	<input type="text" name="SGHits2" id="SGHits2" value="0" /><br />' +
                'PGKills: 	<input type="text" name="PGKills2" id="PGKills2" value="0" /><br />' +
                'PGShots: 	<input type="text" name="PGShots2" id="PGShots2" value="0" /><br />' +
                'PGHits: 	<input type="text" name="PGHits2" id="PGHits2" value="0" /><br />' +
                'RLKills: 	<input type="text" name="RLKills2" id="RLKills2" value="0" /><br />' +
                'RLShots: 	<input type="text" name="RLShots2" id="RLShots2" value="0" /><br />' +
                'RLHits: 	<input type="text" name="RLHits2" id="RLHits2" value="0" /><br />' +
                'LGKills: 	<input type="text" name="LGKills2" id="LGKills2" value="0" /><br />' +
                'LGShots: 	<input type="text" name="LGShots2" id="LGShots2" value="0" /><br />' +
                'LGHits: 	<input type="text" name="LGHits2" id="LGHits2" value="0" /><br />' +
                'RGKills: 	<input type="text" name="RGKills2" id="RGKills2" value="0" /><br />' +
                'RGShots: 	<input type="text" name="RGShots2" id="RGShots2" value="0" /><br />' +
                'RGHits: 	<input type="text" name="RGHits2" id="RGHits2" value="0" /><br />' +
                'BFGKills: 	<input type="text" name="BFGKills2" id="BFGKills2" value="0" /><br />' +
                'BFGShots: 	<input type="text" name="BFGShots2" id="BFGShots2" value="0" /><br />' +
                'BFGHits: 	<input type="text" name="BFGHits2" id="BFGHits2" value="0" /><br />' +
                'GLKills: 	<input type="text" name="GLKills2" id="GLKills2" value="0" /><br />' +
                'GLShots: 	<input type="text" name="GLShots2" id="GLShots2" value="0" /><br />' +
                'GLHits: 	<input type="text" name="GLHits2" id="GLHits2" value="0" /><br />' +
                'TFKills: 	<input type="text" name="TFKills2" id="TFKills2" value="0" /><br />' +
                '<input type="submit" />' +
                '</form>';

                res.send(htmlHeader + responseHTML + htmlFooter);
            }
        });
});

app.post('/api/creatematch/submit', function(req, res) {
    if (req.body.P1ID == req.body.P2ID) {
        console.log('/api/creatematch: %s', "Both playerids are identical.");
        res.send(htmlHeader + "Error: Both players cannot be the same.");
    }
    var Match = new Match_s(req.body.Datetime, req.body.Map, "1v1");
    var P1PlayerStats = new PlayerStats_s('', req.body.Score1, req.body.Kills1, req.body.Deaths1, req.body.Suicides1, req.body.Net1, req.body.DamageGiven1,
                                            req.body.DamageTaken1, req.body.HealthTotal1, req.body.ArmorTotal1, req.body.Captures1, req.body.Assists1,
                                            req.body.Defense1, req.body.Returns1);
    var P1WeaponStats = new WeaponStats_s(req.body.GKills1, req.body.MGKills1, req.body.MGShots1, req.body.MGHits1, req.body.SGKills1, req.body.SGShots1,
    									req.body.SGHits1, req.body.PGKills1, req.body.PGShots1, req.body.PGHits1, req.body.RLKills1, req.body.RLShots1,
    									req.body.RLHits1, req.body.LGKills1, req.body.LGShots1, req.body.LGHits1, req.body.RGKills1, req.body.RGShots1,
    									req.body.RGHits1, req.body.GLKills1, req.body.GLShots1, req.body.GLHits1, req.body.BFGKills1, req.body.BFGShots1,
    									req.body.BFGHits1, req.body.TFKills1);
    var P1ItemStats = new ItemStats_s(req.body.MHPickups1, req.body.RAPickups1, req.body.YAPickups1, req.body.GAPickups1, req.body.QuadPickups1,
                                    req.body.BSPickups1, req.body.InvisPickups1, req.body.FlightPickups1, req.body.RegenPickups1,
                                    req.body.FlagGrabs1, req.body.QuadTime1, req.body.BSTime1, req.body.InvisTime1, req.body.FlightTime1, req.body.RegenTime1, req.body.FlagTime1);

    var P2PlayerStats = new PlayerStats_s('', req.body.Score2, req.body.Kills2, req.body.Deaths2, req.body.Suicides2, req.body.Net2, req.body.DamageGiven2,
                                                req.body.DamageTaken2, req.body.HealthTotal2, req.body.ArmorTotal2, req.body.Captures2, req.body.Assists2,
                                                req.body.Defense2, req.body.Returns2);
    var P2WeaponStats = new WeaponStats_s(req.body.GKills2, req.body.MGKills2, req.body.MGShots2, req.body.MGHits2, req.body.SGKills2, req.body.SGShots2,
                                        req.body.SGHits2, req.body.PGKills2, req.body.PGShots2, req.body.PGHits2, req.body.RLKills2, req.body.RLShots2,
                                        req.body.RLHits2, req.body.LGKills2, req.body.LGShots2, req.body.LGHits2, req.body.RGKills2, req.body.RGShots2,
                                        req.body.RGHits2, req.body.GLKills2, req.body.GLShots2, req.body.GLHits2, req.body.BFGKills2, req.body.BFGShots2,
                                        req.body.BFGHits2, req.body.TFKills2);
    var P2ItemStats = new ItemStats_s(req.body.MHPickups2, req.body.RAPickups2, req.body.YAPickups2, req.body.GAPickups2, req.body.QuadPickups2,
                                    req.body.BSPickups2, req.body.InvisPickups2, req.body.FlightPickups2, req.body.RegenPickups2,
                                    req.body.FlagGrabs2, req.body.QuadTime2, req.body.BSTime2, req.body.InvisTime2, req.body.FlightTime2, req.body.RegenTime2, req.body.FlagTime2);

    parseDuelData2(res, Match, req.body.P1ID, P1PlayerStats, P1ItemStats, P1WeaponStats, req.body.P2ID, P2PlayerStats, P2ItemStats, P2WeaponStats);
});

app.get('/api/deletematch', function (req, res) {
    var query = 'SELECT p1.PlayerID as P1ID, p1.Name as P1Name, p1s.Score '
              + 'as P1Score, p2.PlayerID as P2ID, p2.Name as P2Name, p2s.Score as P2Score, m.Map, m.Datetime, m.MatchID '
              + 'FROM Players p1 '
              + 'INNER JOIN PlayersMatches pm '
              + 'ON p1.PlayerID = pm.PlayerID '
              + 'INNER JOIN Matches m '
              + 'ON pm.MatchID = m.MatchID '
              + 'INNER JOIN DuelMatchStats dm '
              + 'ON m.MatchID = dm.MatchID '
              + 'INNER JOIN PlayerStats p1s '
              + 'ON dm.Player1StatsID = p1s.PlayerStatsID '
              + 'INNER JOIN Players p2 '
              + 'ON dm.Player2ID = p2.PlayerID '
              + 'INNER JOIN PlayerStats p2s '
              + 'ON dm.Player2StatsID = p2s.PlayerStatsID '
              + 'WHERE p1.PlayerID != p2.PlayerID '
              + 'ORDER BY m.Datetime DESC';
    console.log('/api/deletematch: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/deletematch: %s', err.toString());
                handleError(res, err);
            }
            else {
                var responseHTML = '<h1>Select Match</h1>'
                    + '<form method="GET" action=/api/deletematch/submit>'
                    + 'Match: <select name="MatchID" id="MatchID">';
                for (var i=0; i<result.length; i++) {
                    responseHTML += '<option value="' + result[i].MatchID + '">'
                    + result[i].P1Name + ' (' + result[i].P1Score + ')'  + ' vs ' + '(' + result[i].P2Score + ') ' + result[i].P2Name + ' on ' + result[i].Map + ', ' + result[i].Datetime
                    + '</option>';
                }
                responseHTML += '</select>'
                + '&nbsp;<input type="submit">'
                + '</form>';

                res.send(htmlHeader + responseHTML + htmlFooter);
            }
        });
});

app.get('/api/deletematch/submit', function (req, res) {
    var query = 'DELETE FROM Matches WHERE MatchID=' + connection.escape(req.query.MatchID);
    console.log('/api/deletematch/submit: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/deletematch/submit: %s', err.toString());
                handleError(res, err);
            }
            else {
                res.send(htmlHeader + "Match Deleted" + htmlFooter);
            }
        });
});

// Create Player Page
app.get('/api/createplayer', function (req, res) {
var responseHTML = htmlHeader
    + '<form action="/api/createplayer/submit" method="GET">'
    + '<label for="Name">Name</label> <input type="text" name="Name" id="Name" /><br />'
    + '<input type="Submit" />'
    + '</form>'
    + htmlFooter;

    res.send(responseHTML);
});

// Create Player Submit Page
app.get('/api/createplayer/submit', function (req, res) {
    var error = false;
    var playerstatsdone = false;
    var PlayerStatsID;
    var itemstatsdone = false;
    var ItemStatsID;
    var weaponstatsdone = false;
    var WeaponStatsID;

    var PlayerIDs = [0, 0, 0, 0];

    var query = 'INSERT INTO Players(Name) VALUES (' + connection.escape(req.query.Name) + ')';
    console.log('/api/createplayer/submit: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                if (!error) {
                    error = true;
                    console.log('/api/createplayer/submit: %s', err.toString());
                    handleError(res, err);
                }
            }
            else {
                PlayerIDs[0] = result.insertId;
                var query2 = 'INSERT INTO PlayerStats (PlayerID) VALUES (' + connection.escape(result.insertId) + ')';
                console.log('/api/createplayer/submit: %s', query2);
                var result2 = connection.query(query2,
                    function (err2, result2) {
                        if (err2) {
                            if (!error) {
                                error = true;
                                console.log('/api/createplayer/submit: %s', err2.toString());
                                handleError(res, err2);
                            }
                        }
                        else {
                            PlayerStatsCallback(result2.insertId);
                        }
                    });
                var query3 = 'INSERT INTO ItemStats (PlayerID) VALUES (' + connection.escape(result.insertId) + ')';
                console.log('/api/createplayer/submit: %s', query3);
                var result3 = connection.query(query3,
                    function (err3, result3) {
                        if (err3) {
                            if (!error) {
                                error = true;
                                console.log('/api/createplayer/submit: %s', err3.toString());
                                handleError(res, err3);
                            }
                        }
                        else {
                            ItemStatsCallback(result3.insertId);
                        }
                    });
                var query4 = 'INSERT INTO WeaponStats (PlayerID) VALUES (' + connection.escape(result.insertId) + ')';
                console.log('/api/createplayer/submit: %s', query4);
                var result4 = connection.query(query4,
                    function (err4, result4) {
                        if (err4) {
                            if (!error) {
                                error = true;
                                console.log('/api/createplayer/submit: %s', err4.toString());
                                handleError(res, err4);
                            }
                        }
                        else {
                            WeaponStatsCallback(result4.insertId);
                        }
                    });
            }
        });

    function PlayerStatsCallback(PlayerStatsID) {
        PlayerIDs[1] = PlayerStatsID;
        playerstatsdone = true;
        if (!error && playerstatsdone && itemstatsdone && weaponstatsdone) {
            updateTables(PlayerIDs[0], PlayerIDs[1], PlayerIDs[2], PlayerIDs[3]);
        }
    }

    function ItemStatsCallback(ItemStatsID) {
        PlayerIDs[2] = ItemStatsID;
        itemstatsdone = true;
        if (!error && playerstatsdone && itemstatsdone && weaponstatsdone) {
            updateTables(PlayerIDs[0], PlayerIDs[1], PlayerIDs[2], PlayerIDs[3]);
        }
    }

    function WeaponStatsCallback(WeaponStatsID) {
        PlayerIDs[3] = WeaponStatsID;
        weaponstatsdone = true;
        if (!error && playerstatsdone && itemstatsdone && weaponstatsdone) {
            updateTables(PlayerIDs[0], PlayerIDs[1], PlayerIDs[2], PlayerIDs[3]);
        }
    }

    function updateTables(PlayerID, PlayerStatsID, ItemStatsID, WeaponStatsID) {
        var query5 = 'UPDATE Players SET PlayerStats=' + connection.escape(PlayerStatsID) + ', ItemStats=' + connection.escape(ItemStatsID)
        + ', WeaponStats=' + connection.escape(WeaponStatsID) + ' WHERE PlayerID=' + connection.escape(PlayerID);
        console.log('/api/createplayer/submit: %s', query5);
        var result5 = connection.query(query5,
            function (err5, result5) {
                if (err5) {
                    console.log('/api/createplayer/submit: %s', err5.toString());
                    handleError(res, err5);
                }
                else {
                    res.send(htmlHeader + "Player Added Successfully" + htmlFooter);
                }
            });
    }
});

// Delete Player Page
app.get('/api/deleteplayer', function (req, res) {
    var query = 'SELECT Name, PlayerID FROM Players';
    console.log('/api/deleteplayer: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/deleteplayer: %s', err.toString());
                handleError(res, err);
            }
            else {
                var responseHTML = '<h1>Select Player</h1>'
                    + '<form method="GET" action=/api/deleteplayer/submit>'
                    + 'Player: <select name="PlayerID" id="PlayerID">';
                for (var i=0; i<result.length; i++) {
                    responseHTML += '<option value="' + result[i].PlayerID + '">'
                    + result[i].Name
                    + '</option>';
                }
                responseHTML += '</select>'
                + '&nbsp;<input type="submit">'
                + '</form>';

                res.send(htmlHeader + responseHTML + htmlFooter);
            }
        });
});

// Delete Player Submit Page
app.get('/api/deleteplayer/submit', function (req, res) {
    var query = 'DELETE FROM Players WHERE PlayerID=' + connection.escape(req.query.PlayerID);
    console.log('/api/deleteplayer/submit: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/deleteplayer/submit: %s', err.toString());
                handleError(err);
            }
            else {
                res.send(htmlHeader + "Player Deleted" + htmlFooter);
            }
        });
});

// Update Player Page
app.get('/api/updateplayer', function (req, res) {
var query = 'SELECT Name, PlayerID FROM Players';
    console.log('/api/updateplayer: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/updateplayer: %s', err.toString());
                handleError(res, err);
            }
            else {
                var responseHTML = '<h1>Select Player</h1>'
                    + '<form method="GET" action=/api/updateplayer/edit>'
                    + 'Player: <select name="PlayerID" id="PlayerID">';
                for (var i=0; i<result.length; i++) {
                    responseHTML += '<option value="' + result[i].PlayerID + '">'
                    + result[i].Name
                    + '</option>';
                }
                responseHTML += '</select>'
                + '&nbsp;<input type="submit">'
                + '</form>';

                res.send(htmlHeader + responseHTML + htmlFooter);
            }
        });
});

// Update Player Edit Page
app.get('/api/updateplayer/edit', function (req, res) {
    var query = 'SELECT * '
                + 'FROM Players p '
                + 'INNER JOIN PlayerStats ps '
                + 'ON p.PlayerStats=ps.PlayerStatsID '
                + 'INNER JOIN ItemStats its '
                + 'ON p.ItemStats=its.ItemStatsID '
                + 'INNER JOIN WeaponStats wps '
                + 'ON p.WeaponStats=wps.WeaponStatsID '
                + 'WHERE p.PlayerID=' + connection.escape(req.query.PlayerID);
    console.log('/api/updateplayer/edit: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/updateplayer/edit: %s', err.toString());
                handleError(res, err);
            }
            else if (result.length ==1) {
                var responseHTML = htmlHeader + '<h1>Edit Player Information</h1>' + '<form action="/api/updateplayer/submit" method="POST">' +
                'Name: 	<input type="text" name="Name" id="Name" value="'               + result[0].Name + '" /><br />' +
                'FirstSeen: <input type="text" name="FirstSeen" id="FirstSeen" value="' + result[0].FirstSeen + '" /><br />' +
                'LastSeen: 	<input type="text" name="LastSeen" id="LastSeen" value="'   + result[0].LastSeen + '" /><br />' +
                'ELO: 	<input type="text" name="ELO" id="ELO" value="'                 + result[0].ELO + '" /><br />' +
                'Score: 	<input type="text" name="Score" id="Score" value="'         + result[0].Score + '" /><br />' +
                'Kills: 	<input type="text" name="Kills" id="Kills" value="'           + result[0].Kills + '" /><br />' +
                'Deaths: 	<input type="text" name="Deaths" id="Deaths" value="'          + result[0].Deaths + '" /><br />' +
                'Suicides: 	<input type="text" name="Suicides" id="Suicides" value="'        + result[0].Suicides + '" /><br />' +
                'Net: 	<input type="text" name="Net" id="Net" value="'                 + result[0].Net + '" /><br />' +
                'DamageGiven: 	<input type="text" name="DamageGiven" id="DamageGiven" value="' + result[0].DamageGiven + '" /><br />' +
                'DamageTaken: 	<input type="text" name="DamageTaken" id="DamageTaken" value="' + result[0].DamageTaken + '" /><br />' +
                'Captures: 	<input type="text" name="Captures" id="Captures" value="'        + result[0].Captures + '" /><br />' +
                'Assists: 	<input type="text" name="Assists" id="Assists" value="'         + result[0].Assists + '" /><br />' +
                'Defense: 	<input type="text" name="Defense" id="Defense" value="'         + result[0].Defense + '" /><br />' +
                'Returns: 	<input type="text" name="Returns" id="Returns" value="'         + result[0].Returns + '" /><br />' +
                'HealthTotal: 	<input type="text" name="HealthTotal" id="HealthTotal" value="' + result[0].HealthTotal + '" /><br />' +
                'ArmorTotal: 	<input type="text" name="ArmorTotal" id="ArmorTotal" value="'  + result[0].ArmorTotal + '" /><br />' +
                'MHPickups: 	<input type="text" name="MHPickups" id="MHPickups" value="'   + result[0].MHPickups + '" /><br />' +
                'RAPickups: 	<input type="text" name="RAPickups" id="RAPickups" value="'   + result[0].RAPickups + '" /><br />' +
                'YAPickups: 	<input type="text" name="YAPickups" id="YAPickups" value="'   + result[0].YAPickups + '" /><br />' +
                'GAPickups: 	<input type="text" name="GAPickups" id="GAPickups" value="'   + result[0].GAPickups + '" /><br />' +
                'QuadPickups: 	<input type="text" name="QuadPickups" id="QuadPickups" value="' + result[0].QuadPickups + '" /><br />' +
                'BSPickups: 	<input type="text" name="BSPickups" id="BSPickups" value="'   + result[0].BSPickups + '" /><br />' +
                'InvisPickups: 	<input type="text" name="InvisPickups" id="InvisPickups" value="'+ result[0].InvisPickups + '" /><br />' +
                'FlightPickups: 	<input type="text" name="FlightPickups" id="FlightPickups" value="'+ result[0].FlightPickups + '" /><br />' +
                'RegenPickups: 	<input type="text" name="RegenPickups" id="RegenPickups" value="'+ result[0].RegenPickups + '" /><br />' +
                'FlagGrabs: 	<input type="text" name="FlagGrabs" id="FlagGrabs" value="'   + result[0].FlagGrabs + '" /><br />' +
                'QuadTime: 	<input type="text" name="QuadTime" id="QuadTime" value="'        + result[0].QuadTime + '" /><br />' +
                'BSTime: 	<input type="text" name="BSTime" id="BSTime" value="'          + result[0].BSTime + '" /><br />' +
                'InvisTime: 	<input type="text" name="InvisTime" id="InvisTime" value="'   + result[0].InvisTime + '" /><br />' +
                'FlightTime: 	<input type="text" name="FlightTime" id="FlightTime" value="'  + result[0].FlightTime + '" /><br />' +
                'RegenTime: 	<input type="text" name="RegenTime" id="RegenTime" value="'   + result[0].RegenTime + '" /><br />' +
                'FlagTime: 	<input type="text" name="FlagTime" id="FlagTime" value="'        + result[0].FlagTime + '" /><br />' +
                'GKills: 	<input type="text" name="GKills" id="GKills" value="'          + result[0].GKills + '" /><br />' +
                'MGKills: 	<input type="text" name="MGKills" id="MGKills" value="'         + result[0].MGKills + '" /><br />' +
                'MGShots: 	<input type="text" name="MGShots" id="MGShots" value="'         + result[0].MGShots + '" /><br />' +
                'MGHits: 	<input type="text" name="MGHits" id="MGHits" value="'          + result[0].MGHits + '" /><br />' +
                'SGKills: 	<input type="text" name="SGKills" id="SGKills" value="'         + result[0].SGKills + '" /><br />' +
                'SGShots: 	<input type="text" name="SGShots" id="SGShots" value="'         + result[0].SGShots + '" /><br />' +
                'SGHits: 	<input type="text" name="SGHits" id="SGHits" value="'          + result[0].SGHits + '" /><br />' +
                'PGKills: 	<input type="text" name="PGKills" id="PGKills" value="'         + result[0].PGKills + '" /><br />' +
                'PGShots: 	<input type="text" name="PGShots" id="PGShots" value="'         + result[0].PGShots + '" /><br />' +
                'PGHits: 	<input type="text" name="PGHits" id="PGHits" value="'          + result[0].PGHits + '" /><br />' +
                'RLKills: 	<input type="text" name="RLKills" id="RLKills" value="'         + result[0].RLKills + '" /><br />' +
                'RLShots: 	<input type="text" name="RLShots" id="RLShots" value="'         + result[0].RLShots + '" /><br />' +
                'RLHits: 	<input type="text" name="RLHits" id="RLHits" value="'          + result[0].RLHits + '" /><br />' +
                'LGKills: 	<input type="text" name="LGKills" id="LGKills" value="'         + result[0].LGKills + '" /><br />' +
                'LGShots: 	<input type="text" name="LGShots" id="LGShots" value="'         + result[0].LGShots + '" /><br />' +
                'LGHits: 	<input type="text" name="LGHits" id="LGHits" value="'          + result[0].LGHits + '" /><br />' +
                'RGKills: 	<input type="text" name="RGKills" id="RGKills" value="'         + result[0].RGKills + '" /><br />' +
                'RGShots: 	<input type="text" name="RGShots" id="RGShots" value="'         + result[0].RGShots + '" /><br />' +
                'RGHits: 	<input type="text" name="RGHits" id="RGHits" value="'          + result[0].RGHits + '" /><br />' +
                'BFGKills: 	<input type="text" name="BFGKills" id="BFGKills" value="'        + result[0].BFGKills + '" /><br />' +
                'BFGShots: 	<input type="text" name="BFGShots" id="BFGShots" value="'        + result[0].BFGShots + '" /><br />' +
                'BFGHits: 	<input type="text" name="BFGHits" id="BFGHits" value="'         + result[0].BFGHits + '" /><br />' +
                'GLKills: 	<input type="text" name="GLKills" id="GLKills" value="'         + result[0].GLKills + '" /><br />' +
                'GLShots: 	<input type="text" name="GLShots" id="GLShots" value="'         + result[0].GLShots + '" /><br />' +
                'GLHits: 	<input type="text" name="GLHits" id="GLHits" value="'          + result[0].GLHits + '" /><br />' +
                'TFKills: 	<input type="text" name="TFKills" id="TFKills" value="'         + result[0].TFKills + '" /><br />' +
                '<input type="hidden" name="PlayerID" id="PlayerID" value="'            + result[0].PlayerID + '" />' +
                '<input type="hidden" name="PlayerStats" id=PlayerStats value="'        + result[0].PlayerStats + '" />' +
                '<input type="hidden" name="WeaponStats" id=WeaponStats value="'        + result[0].WeaponStats + '" />' +
                '<input type="hidden" name="ItemStats" id=ItemStats value="'            + result[0].ItemStats + '" />' +
                '<input type="submit" />' +
                '</form>' +
                htmlFooter;

            res.send(responseHTML);
            }
        });
})

// Update Player Submit Page
app.post('/api/updateplayer/submit', function (req, res) {
    var query = 'UPDATE Players p, PlayerStats ps, ItemStats its, WeaponStats wps '
              + 'SET p.Name=' + connection.escape(req.body.Name) + ', p.FirstSeen=' + connection.escape(req.body.FirstSeen)
              + ', p.LastSeen=' + connection.escape(req.body.LastSeen) + ', p.ELO=' + connection.escape(req.body.ELO) + ', '
              + 'ps.Score=' + connection.escape(req.body.Score) + ', ps.Kills=' + connection.escape(req.body.Kills)
              + ', ps.Deaths=' + connection.escape(req.body.Deaths) + ', ps.Suicides=' + connection.escape(req.body.Suicides) + ', '
              + 'ps.Net=' + connection.escape(req.body.Net) + ', ps.DamageGiven=' + connection.escape(req.body.DamageGiven)
              + ', ps.DamageTaken=' + connection.escape(req.body.DamageTaken) + ', ps.DamageGiven=' + connection.escape(req.body.DamageGiven) + ', '
              + 'ps.Captures=' + connection.escape(req.body.Captures) + ', ps.Assists=' + connection.escape(req.body.Assists)
              + ', ps.Defense=' + connection.escape(req.body.Defense) + ', ps.Returns=' + connection.escape(req.body.Returns) + ', '
              + 'ps.HealthTotal=' + connection.escape(req.body.HealthTotal) + ', ps.ArmorTotal=' + connection.escape(req.body.ArmorTotal) + ', '
              + 'its.MHPickups=' + connection.escape(req.body.MHPickups) + ', its.RAPickups=' + connection.escape(req.body.RAPickups)
              + ', its.YAPickups=' + connection.escape(req.body.YAPickups) + ', its.GAPickups=' + connection.escape(req.body.GAPickups) + ', '
              + 'its.QuadPickups=' + connection.escape(req.body.QuadPickups) + ', its.BSPickups=' + connection.escape(req.body.BSPickups)
              + ', its.InvisPickups=' + connection.escape(req.body.InvisPickups) + ', its.RegenPickups=' + connection.escape(req.body.RegenPickups) + ', '
              + 'its.FlagGrabs=' + connection.escape(req.body.FlagGrabs) + ', its.QuadTime=' + connection.escape(req.body.QuadTime)
              + ', its.BSTime=' + connection.escape(req.body.BSTime) + ', its.InvisTime=' + connection.escape(req.body.InvisTime)
              + ', its.FlightTime=' + connection.escape(req.body.FlightTime) + ', ' + 'its.RegenTime=' + connection.escape(req.body.RegenTime)
              + ', its.FlagTime=' + connection.escape(req.body.FlagTime) + ', '
              + 'wps.GKills=' + connection.escape(req.body.GKills) + ', wps.MGKills=' + connection.escape(req.body.MGKills)
              + ', wps.MGShots=' + connection.escape(req.body.MGShots) + ', wps.MGHits=' + connection.escape(req.body.MGHits)
              + ', wps.SGKills=' + connection.escape(req.body.SGKills) + ', ' + 'wps.SGShots=' + connection.escape(req.body.SGShots)
              + ', wps.SGHits=' + connection.escape(req.body.SGHits) + ', wps.PGKills=' + connection.escape(req.body.PGKills)
              + ', wps.PGShots=' + connection.escape(req.body.PGShots) + ', wps.PGHits=' + connection.escape(req.body.PGHits) + ', '
              + 'wps.RLKills=' + connection.escape(req.body.RLKills) + ', wps.RLShots=' + connection.escape(req.body.RLShots)
              + ', wps.RLHits=' + connection.escape(req.body.RLHits) + ', wps.LGKills=' + connection.escape(req.body.LGKills)
              + ', wps.LGShots=' + connection.escape(req.body.LGShots) + ', ' + 'wps.LGHits=' + connection.escape(req.body.LGHits)
              + ', wps.RLKills=' + connection.escape(req.body.RLKills) + ', wps.RLShots=' + connection.escape(req.body.RLShots)
              + ', wps.RLHits=' + connection.escape(req.body.RLHits) + ', wps.BFGKills=' + connection.escape(req.body.BFGKills) + ', '
              + 'wps.BFGShots=' + connection.escape(req.body.BFGShots) + ', wps.BFGHits=' + connection.escape(req.body.BFGHits)
              + ', wps.GLKills=' + connection.escape(req.body.GLKills) + ', wps.GLShots=' + connection.escape(req.body.GLShots)
              + ', wps.GLHits=' + connection.escape(req.body.GLHits) + ', wps.TFKills=' + connection.escape(req.body.TFKills) + ' '
              + 'WHERE p.PlayerID=' + connection.escape(req.body.PlayerID) + ' AND ps.PlayerStatsID=' + connection.escape(req.body.PlayerStats)
              + ' AND wps.WeaponStatsID=' + connection.escape(req.body.WeaponStats) + ' AND its.ItemStatsID=' + connection.escape(req.body.ItemStats);
    console.log('/api/updateplayer/submit: %s', query);
    var result = connection.query(query,
        function (err, result) {
            if (err) {
                console.log('/api/updateplayer/submit: %s', err.toString());
                handleError(res, err);
            }
            else {
                res.send(htmlHeader + "Player Updated" + htmlFooter);
            }
        })
});

// Begin listening
app.listen(8041);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);