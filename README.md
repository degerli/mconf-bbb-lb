mconf-bbb-lb
============

`mconf-bbb-lb` is a load balancer for [BigBlueButton](http://mconf.org) servers created for [Mconf](http://mconf.org).

It is a [Node.js](http://nodejs.org/) application that routes API calls to a given BigBlueButton server either proxying them or returning HTTP redirects.


Development
-----------

Currently using:

    node -v v0.6.12
    npm -v 1.1.4

Download and install [Node.js](http://nodejs.org/) and then the dependencies with:

    npm install -d

Install some packages globally to have easy access to the executables (`x.x.x` is the version to be installed, see `package.json`):

    sudo npm install -g coffee-script@x.x.x groc@x.x.x js2coffee
    # groc to generate the documentation
    # js2coffee to convert .js to .coffee

Copy the local config file and edit it:

    cp config_local.coffee.example config_local.coffee

Run the server:

    node app.js


### Documentation

We use [groc](https://github.com/nevir/groc) to generate the documentation. Commands:

    groc
    groc --github # to update the docs in gh-pages


Deployment
----------

_(Note: in Ubuntu)_

In your server, download and install [Node.js](http://nodejs.org/). You can [install from source](https://github.com/joyent/node/wiki/Installation) or [via package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager).

Install global packages (`x.x.x` is the version to be installed, see `package.json`):

    sudo npm install -g coffee-script@x.x.x forever@x.x.x

Install Nginx and then configure it:

    sudo vim /etc/nginx/sites-available/mconf_bbb_lb
    # Paste inside the contents of 'config/nginx.example' and save it.
    # Don't forget to read it, you have to set at least your domain/IP in the proper location.

    sudo rm /etc/nginx/sites-enabled/*
    sudo ln -s /etc/nginx/sites-available/mconf_bbb_lb /etc/nginx/sites-enabled/mconf_bbb_lb

    sudo /etc/init.d/nginx restart # to test it

From now on you can either use Capistrano to deploy the application or do it manually.


### Deployment with Capistrano

Install Ruby and Capistrano in your development machine. See the current versions in `config/deploy.rb`.

Copy the deployment config file and edit it:

    cp config/deploy/conf.yml.example config/deploy/conf.yml

Make sure that the user configured in `config/deploy/conf.yml` exists and has permission to `sudo`.

First setup:

    cap deploy:setup

Then deploy:

    cap deploy:update
    cap deploy:restart

More about Mconf
----------------

This project is developed as a part of Mconf. See more about Mconf at:

* [Mconf website](http://mconf.org)
* [Mconf @ Google Code](http://code.google.com/p/mconf)
* [Mconf @ GitHub](https://github.com/mconf)
