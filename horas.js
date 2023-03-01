(function(d, s, id){
	var url = 'https://raw.githubusercontent.com/frasator/bamboo-plus/gh-pages/timesheet-plus.js'
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)){ return; }
    js = d.createElement(s); js.id = id;
    js.onload = function(){
		console.log(js)
    };
    js.src = url;
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'horas-code'));