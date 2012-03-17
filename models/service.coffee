Service = exports = module.exports = Service = (name, data) ->
  @name = name
  @data = data
  this

# Example: 'meetings=2;5;10;0; ...'
Service::getIntSync = (name) ->
  re = new RegExp(name + "=(\\d+);")
  parseInt @data.match(re)[1]

# Example: 'meetings=2;5;10;0; ...' to 'meeting=3;5;10;0; ...'
Service::setIntSync = (name, value) ->
  re = new RegExp(name + "=(\\d+);", "g")
  newValue = name + "=" + value + ";"
  @data = @data.replace(re, newValue)
