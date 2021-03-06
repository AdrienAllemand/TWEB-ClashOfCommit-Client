

// https://medium.freecodecamp.org/environment-settings-in-javascript-apps-c5f9744282b6
const serverUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://afternoon-stream-70340.herokuapp.com';


const defaultSearch = 'octocat';
const searchForm = document.getElementById('search-form');
let token = readCookie('access_token');

window.onload = onPageLoaded();

function onPageLoaded(){
  // console.log("app.js: Loading page");
  
  let buttonLogin = document.getElementById("buttonLogin");

  // take care of the login/logout button
  if(token === null){
    
    // console.log("app.js: token is null on load");
    hideRepo();
    buttonLogin.removeEventListener("click", logout);
    buttonLogin.addEventListener("click", login);
    buttonLogin.textContent = "Login"; 
    
    // send the code of this is a redirection
    sendCodeToServer(getGitHubCodeFromURL());

  } else {
    buttonLogin.removeEventListener("click", login);
    buttonLogin.addEventListener("click", logout);
    buttonLogin.textContent = "Logout"; 

    // console.log("app.js: Token is not null on load");
    handleRepoList();
  }
  

  // console.log("app.js: Page loaded");
}

function login(){
  location.href="https://github.com/login/oauth/authorize?client_id=7141a9444cbe3a0b80bd&scope=user,repo";
}

function logout(){
  hideRepo();
  deleteAllCookies();
  location.href="./index.html";
}

function deleteAllCookies() {
  var cookies = document.cookie.split(";");

  for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];
      var eqPos = cookie.indexOf("=");
      var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}

function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function sendCodeToServer(code) {
  if ((token === undefined || token === null)) {
    if (code !== undefined && code !== null) {
      
    // console.log("app.js: Sending code to server");

      fetch(`${serverUrl}/githubredirect?code=${code}`)
        .then(data => {
          if(data.ok){
            return data;
          } else {
            // console.log('Can\'t reach server');
            showNotification('Can\'t reach server', 4);
          }
        })
        .then(data => data.json()
          .then(data => {
            let stringToken = data.access_token;
            document.cookie = `access_token=${stringToken}`;
            token = readCookie('access_token');

            // start loading
            startLoading();
            
            // console.log("app.js: We got answer from server");
            // maj de la liste des repos
            handleRepoList();
          }))
          .catch(err => {
            showNotification('Oups, an error occured. Sorry, this app sucks...', 4);
            console.error('Cannot fetch data', err)
          });
    }
  }
}

// extracts the Githubcode parameter from url
function getGitHubCodeFromURL() {
  let url_string = window.location.href;
  let url = new URL(url_string);
  let code = url.searchParams.get("code");
  return code
}

function getRepos() {
  return fetch(`${serverUrl}/auth/myrepos?access_token=${token}`)
    .then(res => res.json());
}

function getIssues(fullname) {
  return fetch(`${serverUrl}/auth/${fullname}/issues?access_token=${token}`)
  .then(res => res.json());
}

function getCollaborators(fullname) {
  return fetch(`${serverUrl}/auth/${fullname}/contributors?access_token=${token}`)
  .then(res => res.json());
}

function handleRepoList() {
  // console.log("app.js: Handeling repo list");

  // si on est pas login on return
  if((token === undefined || token === null)){
    // console.log("Token is null");
    showNotification('You must login first !', 1)
    
    return;
  }

  return getRepos()
    .then(repos => {
      // console.log(`We got the user's repos : ${JSON.stringify(repos)}`);

      updateUserReposList(repos);

    })
    .catch(err => {
      showNotification('Oups, an error occured. Sorry, this app sucks...', 4);
      console.error('Cannot fetch data', err)
    })
}

function showNotification(message, colorNo) {

  $.notify({
    icon: "tim-icons icon-bell-55",
    message

  }, {
    type: type[colorNo],
    timer: 8000,
    placement: {
      from: 'top',
      align: 'center'
    }
  });
}

function updateUserReposList(repos){
  //create selection field
  let parent = document.getElementById('UserReposListHolder');
  let select = document.createElement("SELECT");
  select.setAttribute("id", "UserReposList");
  select.setAttribute("class","form-control");
  parent.appendChild(select);

  // create a selectionnable list of user owned repos
  repos.forEach(repo => {
    // console.log(`Repo : ${repo.name}`);
    let option = document.createElement("option");
    option.setAttribute("value", repo.full_name);
    option.setAttribute("class","form-control option");

    let text = document.createTextNode(repo.name);
    option.appendChild(text);

    document.getElementById("UserReposList").appendChild(option);
  });

  // listen to change event
  select.addEventListener("change", handleChangeRepoSelected);

  handleChangeRepoSelected();

  endLoading();
  displayRepos();
}

// hangle che event of changing selected repo
function handleChangeRepoSelected(){

  startLoading();
  // get the selected repository
  let select = document.getElementById('UserReposList');
  let selectedRepo = select.options[select.selectedIndex].value;
  let filteredData = null;

  // pass it to the server to get the collaborators working on it
  getCollaborators(selectedRepo)
    .then(data => {

      // filter the needed data
      filteredData = data.map(collaborator => {

        let filteredCollaborator = {};//new Object();
        filteredCollaborator.login = collaborator.login;
        filteredCollaborator.contributions = collaborator.contributions;
        filteredCollaborator.issueClosed = 0;
        return filteredCollaborator;
      });
    })
    .then(a => {

      // once we have the collaborators, we can track their solved issues
      getIssues(selectedRepo)
        .then(data => {

          // foreach issus we increment the assignee's issueClosed counter
          data.forEach(issue => {
            for(let i = 0; i < filteredData.length; ++i){
              if(issue.assignee.login === filteredData[i].login){
                ++filteredData[i].issueClosed;
              }
            }
          })
    })
    .then(data => {
      //// console.log(`Chart gonna be updates with data : ${JSON.stringify(filteredData)}`);
      // once all the data is packed we update the charts;
      updateChart('chart-issues',
        filteredData.map(coll => coll.login), 
        filteredData.map(coll => coll.issueClosed), 
        'bar');

      updateChart('chart-commits',
        filteredData.map(coll => coll.login), 
        filteredData.map(coll => coll.contributions), 
        'bar');
      //// console.log('update done');

      endLoading();
    })})
    .catch(err => {
      showNotification('Oups, an error occured. Sorry, this app sucks...', 4);
      console.error('Cannot fetch data', err)
    });
}

// Charts stuff 



function updateChart(chartId,labels, data, chartType){
  const chartContributors = document.getElementById(chartId);
  const ctx = chartContributors.getContext('2d');

  // create a nice gradiant
  var gradientStroke = ctx.createLinearGradient(0, 230, 0, 50);
  gradientStroke.addColorStop(1, 'rgba(29,140,248,0.3)');
  gradientStroke.addColorStop(0.4, 'rgba(29,140,248,0.0)');
  gradientStroke.addColorStop(0, 'rgba(29,140,248,0)'); //blue colors

  const options = {
    type: chartType,
    data: {
      labels,
      datasets: [{
        fill: true,
        backgroundColor: gradientStroke,
        hoverBackgroundColor: gradientStroke,
        borderColor: '#1f8ef1',
        borderWidth: 2,
        borderDash: [],
        borderDashOffset: 0.0,
        data,
      }],
    },
    options: {
      maintainAspectRatio: false,
      legend: {
        display: false
      },
    
      tooltips: {
        backgroundColor: '#f5f5f5',
        titleFontColor: '#333',
        bodyFontColor: '#666',
        bodySpacing: 4,
        xPadding: 12,
        mode: "nearest",
        intersect: 0,
        position: "nearest",
      },
      responsive: true,
      scales: {
        yAxes: [{
    
          gridLines: {
            drawBorder: false,
            color: 'rgba(29,140,248,0.1)',
            zeroLineColor: "transparent",
          },
          ticks: {
            precision: 0,
            padding: 20,
            fontColor: "#9e9e9e",
            startAtZero: true,
          }
        }],
    
        xAxes: [{
          gridLines: {
            drawBorder: false,
            color: 'rgba(29,140,248,0.1)',
            beginAtZero: "transparent",
          },
          ticks: {
            padding: 20,
            fontColor: "#9e9e9e",
          }
        }]
      }
    }
  }
  new Chart(ctx, options);
  /*
  if (!chart) {
    chart = new Chart(ctx, options);
  } else {
    chart.data.labels = options.data.labels;
    chart.data.datasets = options.data.datasets;
    chart.update();
  }
  */
}

/*Page controls*/
/**
     * This function is called at the beginning or when the logout button is pressed
     */
    function hideRepo () {
      //hide the following elements 
      document.getElementById("login-loading").style.display = "none";
      document.getElementById("repository-choice").style.display = "none"; 
      document.getElementById("clash-of-issues-chart").style.display = "none"; 
      document.getElementById("clash-of-commit-chart").style.display = "none"; 

      //show the following elements
      document.getElementById("login").style.display = "block"; 
      document.getElementById("login-button").style.display = "block";   
  };

  /**
   * That function is called when the user press the login button, during the process of login with gituhub
   */
  function startLoading()  {
      //show the following elements
      document.getElementById("login-loading").style.display = "flex";
  };

  function endLoading(){
      document.getElementById("login-loading").style.display = "none";
  }

  function displayRepos(){
      //show the following elements 
      document.getElementById("repository-choice").style.display = "block"; 
      document.getElementById("clash-of-issues-chart").style.display = "block"; 
      document.getElementById("clash-of-commit-chart").style.display = "block";
  }; 