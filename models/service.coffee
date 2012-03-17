# # Model Service
# A simple class `Service` to represent services from a Nagios server.
# A service stores information for a server, such as the number of meetings
# running and the CPU load.

Service = exports = module.exports = Service = (name, data) ->
  @name = name
  @data = data
  this

# Example:
#
# * parses`meetings=2;5;10;0; ...` and returns `2`.
Service::getIntSync = (name) ->
  re = new RegExp(name + "=(\\d+);")
  parseInt @data.match(re)[1]

# Example:
#
# * changes `meetings=2;5;10;0; ...' to 'meeting=3;5;10;0; ...`.
Service::setIntSync = (name, value) ->
  re = new RegExp(name + "=(\\d+);", "g")
  newValue = name + "=" + value + ";"
  @data = @data.replace(re, newValue)
