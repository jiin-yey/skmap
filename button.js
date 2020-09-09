const bt1 = document.querySelector("#bt1");
const bt2 = document.querySelector("#bt2");
const bt3 = document.querySelector("#bt3");
const bt4 = document.querySelector("#bt4");
const bt5 = document.querySelector("#bt5");
const bt6 = document.querySelector("#bt6");
const btn3 = document.querySelector("#button3");

bt1.addEventListener("click", () => {
  window.onload = function () {
    var reloading = sessionStorage.getItem("reloading");
    if (reloading) {
      sessionStorage.removeItem("reloading");
      $("#draw_area").css("background-image", "url(b1.jpg)");
      $("#bt2, #bt3, #bt4, #bt5, #bt6").css("border", "solid white");
      $("#bt1").css("border", "solid black");
    }
  };

  function b1() {
    sessionStorage.setItem("reloading", "true");
    document.location.reload();
  }
});

window.onload = function () {
  var reloading = sessionStorage.getItem("reloading");
  if (reloading) {
    sessionStorage.removeItem("reloading");
    $("#draw_area").css("background-image", "url(1층.jpg)");
    $("#bt1, #bt3, #bt4, #bt5, #bt6").css("border", "solid white");
    $("#bt2").css("border", "solid black");
  }
};

function f1() {
  sessionStorage.setItem("reloading", "true");
  document.location.reload();
}

bt3.addEventListener("click", () => {
  location.reload(function () {
    $("#draw_area").css("background-image", "url(2층.jpg)");
    $("#bt1, #bt2, #bt4, #bt5, #bt6").css("border", "solid white");
    $("#bt3").css("border", "solid black 2px");
  });
});

bt4.addEventListener("click", () => {
  $("#draw_area").css("background-image", "url(3층.jpg)");
  $("#bt2, #bt3, #bt1, #bt5, #bt6").css("border", "solid white");
  $("#bt4").css("border", "solid black 2px");
});

bt5.addEventListener("click", () => {
  location.reload(function () {
    $("#draw_area").css("background-image", "url(4층.jpg)");
    $("#bt2, #bt3, #bt4, #bt1, #bt6").css("border", "solid white");
    $("#bt5").css("border", "solid black 2px");
    $("#bt5").css("border-radius", "6px");
  });
});

bt6.addEventListener("click", () => {
  location.reload(function () {
    $("#draw_area").css("background-image", "url(5층.jpg)");
    $("#bt2, #bt3, #bt4, #bt5, #bt1").css("border", "solid white");
    $("#bt6").css("border", "solid black 2px");
  });
});

btn3.addEventListener("click", () => {
  location.reload();
});
