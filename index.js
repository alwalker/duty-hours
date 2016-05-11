var express = require('express');
var pg = require('pg');
var app = express();

app.set('port', (process.env.PORT || 5000));

//app.use(express.static(__dirname + '/public'));

// views is directory for all template files
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');

app.get('/', function(request, response) {
	response.send('Woooo!');
});

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});

app.get('/users', function (request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		if (err)
				{ console.error(err); response.send("Error " + err); }
		client.query('SELECT * FROM users', function(err, result) {
			done();
			if (err)
				{ console.error(err); response.send("Error " + err); }
			else
				{ response.send({results: result.rows}); }
		});
	});
})
