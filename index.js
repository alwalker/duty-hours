var express = require('express');
var pg = require('pg');
var bodyParser = require('body-parser');
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json());

app.get('/', function(request, response) {
	response.send('Woooo!');
});

app.put('/api/:user/shift', function(request, response) {
	findUser(
		request.params.user,
		function() {response.send("Couldn't find user!");}, 
		function(user) {
			pg.connect(process.env.DATABASE_URL, function(err, client, done) {
				if (err) { 
					console.error(err);
					response.send("Error adding shift to database"); 
				}
				client.query(
					'INSERT INTO shifts (user_id, start_dt, end_dt) VALUES($1,$2,$3)',
					[user['id'], request.body.start, request.body.end],
					function(err, result) {
						done();
						if (err) { 
							console.error(err); 
							response.send("Error adding shift to database"); 
						}
						else { 
							response.send('Ok!'); 
						}
					});
			});
		});
});

//we are going to assume date only here for simplifcation
app.get('/api/:user/shifts/start/:start/end/:end', function(request, response) {
	findUser(
		request.params.user,
		function() {response.send("Couldn't find user!");}, 
		function(user) {
			pg.connect(process.env.DATABASE_URL, function(err, client, done) {
				if (err) { 
					console.error(err); 
					response.send("Error looking up shifts"); 
				}
				client.query(
					"SELECT start_dt, end_dt FROM shifts WHERE user_id = $1 AND start_dt >= $2 AND end_dt <= $3",
					[user['id'], request.params.start, request.params.end],
					function(err, result) {
						done();
						if (err) { 
							console.error(err); 
							response.send("Error looking up shifts"); 
						}
						else { 
							response.send(result.rows); 
						}
					});
			});
		});
});

app.get('/api/:user/shift-analysis', function(request, response) {
	findUser(
		request.params.user,
		function() {response.send("Couldn't find user!");}, 
		function(user) {
			//Assuming user IDs are passed in here for simplicity
			var users = request.query.users || [user['id']];
			var start_date = new Date(request.query.start + ' 00:00:00');
			var end_date = new Date(start_date);
			end_date.setDate(end_date.getDate() + 28);
			end_date.setHours(23,59,59,999);

			getShiftsForAnalysis(users, start_date, end_date, 
				function() {response.send('Error performing analysis');},
				function(results) {
					//loop thru and build dictionary of shifts per user
					shifts = {};
					for(var row in results) {
						if(!shifts[results[row]['user_id']]) {
							shifts[results[row]['user_id']] = [];
						}
						shifts[results[row]['user_id']].push({
							"id": results[row]['id'],
							"start": new Date(results[row]['start_dt']),
							"end": new Date(results[row]['end_dt'])
						});
					}

					var violations = {};
					for(var u in shifts) {
						prev = null;
						total_hours = 0;
						hours_off_week = {1: 0, 2: 0, 3: 0, 4: 0};
						violations[u] = {"over80week": [], "no24off": false, "over24shift": [], "no8break": []}; 
						for(var s in shifts[u]) {
							var shift = shifts[u][s];
							console.log("Shift: " + shift['id']);

							//compute hours from shift that are in range
							var hours = null;
							if(end_date.getTime() > shift['end'].getTime()){
								hours = shift['end'].getTime() - shift['start'].getTime();
							}
							else {
								hours = end_date.getTime() - shift['start'].getTime();
							}
							hours = hours / (1000 * 60 * 60); //simple truncation not rounding
							console.log("\thours: " + hours);

							//check for greater than 24 hour shift violation
							if(hours > 24) {
								violations[u]["over24shift"].push(shift);
							}

							//compute hours off as time between shifts or if null from start of day
							//Note: 
							//	this assumes that the dates in the shifts returned from the 
							//	database call are in order (done by ORDER BY clause) and also
							//	non overlapping (not handled IMO would be handled as both client
							//	side and server side validation logic).
							var hours_off = null;
							if(!prev) {
								var start_of_day = new Date(shift['start']);
								start_of_day.setHours(0,0,0,0);
								hours_off = shift['start'].getTime() - start_of_day;
							}
							else {
								hours_off = shift['start'].getTime() - prev['end'].getTime();
							}
							hours_off = hours_off / (1000 * 60 * 60);
							console.log("\thours off: " + hours_off);

							//figure out what week we're in
							//Note: counting from start of shift and accuracy is in days
							var days_from_start = (shift['start'].getTime() - start_date.getTime()) / (1000 * 60 * 60 * 24);
							var week = Math.min(parseInt(days_from_start/7) + 1, 4)
							//check hours off if longest per week and save if is
							if(hours_off > hours_off_week[week]) {
								hours_off_week[week] = hours_off;
							}

							
							//check for at least 8 hour shift gap
							if(hours_off < 8) {
								violations[u]["no8break"].push(shift);
							}

							//add hours to total
							total_hours += hours;
							console.log("\tTotal Hours: " + total_hours);

							//if total is greater than 320 add this shift to violation
							//Note: also assumes shifts are in order
							if(total_hours > 320) {
								violations[u]["over80week"].push(shift);
							}

							//set previous shift
							prev = shift;
						}
						//average 24 hour day off per week
						//Note: Problem states "Residents must have a 24-hour day off each week averaged over a four-week period."
						//Thus I've taken the longest day off per week and checked to mak sure
						//those four days average up to be at least 24
						if((hours_off_week[1] + hours_off_week[2] + hours_off_week[3] + hours_off_week[4])/4 < 24) {
							violations[u]["no24off"] = true;
						}
					}
					response.send(violations);
				});			
		});
});

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});





function findUser(user, not_found_func, found_func) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		if (err) { 
			console.error(err); 
			not_found_func();
			return;
		}
		client.query('SELECT * FROM users', function(err, result) {
			done();
			if (err) { 
				console.error(err); 
				not_found_func();
				return;
			}
			else {
				for(var row in result.rows) {
					if(result.rows[row]['email'] === user) {
						console.log('found them!');
						found_func(result.rows[row]);
						return;
					}
				}
				console.log('not found!');
				not_found_func();
			}
		});
	});
}

function getShiftsForAnalysis(users, start_date, end_date, failure, success) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		if (err) { 
			console.error(err); 
			response.send("Error looking up shifts"); 
		}
		client.query(
			"SELECT id, user_id, start_dt, end_dt FROM shifts WHERE start_dt >= $1 AND end_dt <= $2 AND user_id IN ($3) ORDER BY user_id, start_dt",
			[start_date, end_date, users.join()],
			function(err, result) {
				done();
				if (err) { 
					console.error(err); 
					failure();
				}
				else { 
					success(result.rows);
				}
			});
	});
}
