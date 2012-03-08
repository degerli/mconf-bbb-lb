var Service = exports = module.exports = function Service(name, data) {
  this.name = name;
  this.data = data;
}

// ex: 'meetings=2;5;10;0; ...'
Service.prototype.getInt = function(name){
  re = new RegExp(name + '=(\\d+);');
  return parseInt(this.data.match(re)[1]);
}

// ex: 'meetings=2;5;10;0; ...' to 'meeting=3;5;10;0; ...'
Service.prototype.setInt = function(name, value){
  re = new RegExp(name + '=(\\d+);', 'g');
  var newValue = name + '=' + value + ';';
  this.data = this.data.replace(re, newValue);
}
