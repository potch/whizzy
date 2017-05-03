var express = require('express');
var passport = require('passport');
var Strategy = require('passport-github').Strategy;
var exphbs  = require('express-handlebars');
var fs = require('fs');

var GitHubApi = require("github");

const { ensureLoggedIn } = require('connect-ensure-login');
 
var github = new GitHubApi({
    // optional 
    debug: true,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub 
    pathPrefix: "", // for some GHEs; none for GitHub 
    headers: {
        "user-agent": "My-Cool-GitHub-App" // GitHub is happy with a unique user agent 
    },
    Promise: Promise,
    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects 
    timeout: 5000
});
 

// Configure the GitHub strategy for use by Passport.
//
// OAuth 2.0-based strategies require a `verify` function which receives the
// credential (`accessToken`) for accessing the GitHub API on the user's
// behalf, along with the user's profile.  The function must invoke `cb`
// with a user object, which will be set at `req.user` in route handlers after
// authentication.
passport.use(new Strategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    scope: ['public_repo']
  },
  function(accessToken, refreshToken, profile, cb) {
    // In this example, the user's GitHub profile is supplied as the user
    // record.  In a production-quality application, the GitHub profile should
    // be associated with a user record in the application's database, which
    // allows for account linking and authentication with other identity
    // providers.
    profile.ACCESS_TOKEN = accessToken;
    return cb(null, profile);
  }));

// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete GitHub profile is serialized
// and deserialized.
passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});


// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.engine('hbs', exphbs({
  extname: '.hbs',
  defaultLayout: 'main'
}));

app.set('view engine', 'hbs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('cookie-parser')());
app.use(express.static('public'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());


// Define routes.
app.get('/', function(req, res) {
  var data = {
    user: req.user
  };
  res.render('home', data);
});

app.get('/vendor/:module', function (req, res) {
  try {
    let metadata = require(req.params.module + '/package.json');
    let mainPath = metadata.main || 'index.js';
    let path = 'node_modules/' + req.params.module + '/' + mainPath;
    res.type('text/javascript');
    fs.createReadStream(path).pipe(res);
  } catch (e) {
    res.status(404);
    res.end('404' + e);
  }
});

app.get('/login', function(req, res){
  res.render('login');
});

app.get('/login/github', passport.authenticate('github'));

app.get(
  '/login/github/return', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  }
);

app.get('/repo/:user/:project',
  ensureLoggedIn(),
  function(req, res){
  
    var repoString = req.params.user + '/' + req.params.project;

    Promise.all([
      github.repos.get({
        owner: req.params.user,
        repo: req.params.project
      }),
      github.search.code({
        q: 'repo:' + repoString + ' language:csv'
      })
    ]).then(function([repo, files]) {
      res.render('repo', {
        user: req.user,
        repo: repo.data,
        repoString: repoString,
        files: files.data.items,
        raw: JSON.stringify(files.data.items, null, 2)
      });
    });
  }
);

app.get('/repo/:user/:project/view',
  ensureLoggedIn(),
  function(req, res){
  
    var repoString = req.params.user + '/' + req.params.project;
  

    res.render('file/view', {
      user: req.user,
      contentURL: '/repo/' + repoString + '/contents?path=' + req.query.path,
      repoString: repoString,
      path: req.query.path
    });
  }
);

app.get('/repo/:user/:project/contents',
  ensureLoggedIn(),      
  function(req, res) {
    var repoString = req.params.user + '/' + req.params.project;
  
    github.repos.getContent({
      owner: req.params.user,
      repo: req.params.project,
      path: req.query.path
    }).then(function(result) {
      res.type('text/plain');
      res.end(result.data.content);
    }).catch(function (e) {
      res.status(400)
      res.end('failed to fetch file ' + req.query.path + ': ' + e);
    });
  }
);

app.get('/repo/:user/:project/fork',
  ensureLoggedIn(),    
  function(req, res) {
    var repoString = req.params.user + '/' + req.params.project;
  
    github.authenticate({
      type: "oauth",
      token: req.user.ACCESS_TOKEN
    });
  
    github.repos.fork({
      owner: req.params.user,
      repo: req.params.project
    }).then(function(result) {
      res.type('text/plain');
      res.end(JSON.stringify(result.data,null,2));
    }).catch(function (e) {
      res.status(400);
      res.end('failed to fork project ' + repoString + ': ' + e);
    });
  }
);

function updateFile({owner, repo, path, branch, contents, commitMsg, user}) {
  
  let scratch = {};
  owner = user.username;
  
  return github.repos.get({
    owner: owner,
    repo: repo
  }).then(function (res) {
    return github.gitdata.getReference({
      owner: owner,
      repo: repo,
      ref: 'heads/' + res.data.default_branch
    });
  }).then(function (res) {
    github.authenticate({
      type: "oauth",
      token: user.ACCESS_TOKEN
    });
    return github.gitdata.createReference({
      owner: owner,
      repo: repo,
      ref: 'refs/heads/' + branch,
      sha: res.data.object.sha
    });
  }).then(function (res) {
    scratch.latestCommit = res.data.object.sha;
    return github.gitdata.getCommit({
      owner: owner,
      repo: repo,
      sha: scratch.latestCommit
    });
  }).then(function (res) {
    scratch.baseTree = res.data.tree.sha;
    github.authenticate({
      type: "oauth",
      token: user.ACCESS_TOKEN
    });
    return github.gitdata.createTree({
      owner: owner,
      repo: repo,
      base_tree: scratch.baseTree,
      tree: [{
        path: path,
        content: contents,
        mode: '100644'
      }]
    });
  }).then(function (res) {
    scratch.newTree = res.data.sha;
    github.authenticate({
      type: "oauth",
      token: user.ACCESS_TOKEN
    });
    return github.gitdata.createCommit({
      owner: owner,
      repo: repo,
      message: commitMsg,
      tree: scratch.newTree,
      parents: [scratch.latestCommit],
    });
  }).then(function (res) {
    github.authenticate({
      type: "oauth",
      token: user.ACCESS_TOKEN
    });
    return github.gitdata.updateReference({
      owner: owner,
      repo: repo,
      ref: 'heads/' + branch,
      sha: res.data.sha
    });
  }).then(function (res) {
    return res.data;
  });
}

app.post('/repo/:owner/:repo/save', function (req, res) {  
  let path = req.body.path;
  
  return updateFile({
    owner: req.params.owner,
    repo: req.params.repo,
    branch: 'whizzy-patch-1',
    path: req.body.path,
    commitMsg: req.body.message,
    contents: req.body.contents,
    user: req.user
  }).then(function (result) {
    res.end(JSON.stringify(result, null, 2));
  }).catch(function (e) {
    res.end('I tried: ' + e);
  });
});

app.post('/repoify', function (req, res) {
  res.redirect(`/repo/${req.body.project}`);
});

app.listen(3000);
