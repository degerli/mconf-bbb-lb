# Current versions being used:
# ruby 1.9.2-p290
# capistrano 2.11.2

# Read the configuration file and set it in capistrano
CONFIG_FILE = File.join(File.dirname(__FILE__), "deploy", "conf.yml")
YAML.load_file(CONFIG_FILE).each{ |key, value| set(key.to_sym, value.to_s) }

role :app, fetch(:server)
role :web, fetch(:server)
role :db, fetch(:server), :primary => true

default_run_options[:pty] = true
set :normalize_asset_timestamps, false

namespace :deploy do
  desc "Prints information about the selected stage"
  task :info do
    puts
    puts "*****************************************************************"
    puts "       server: #{ fetch(:server) }"
    puts "       branch: #{ fetch(:branch) }"
    puts "   repository: #{ fetch(:repository) }"
    puts "  application: #{ fetch(:application) }"
    puts " release path: #{ release_path }"
    puts "*****************************************************************"
    puts
  end

  desc "Stop Forever"
  task :stop, :roles => :app do
    run "cd #{current_path} && forever stop app.js"
  end

  desc "Start Forever"
  task :start, :roles => :app do
    run "cd #{current_path} && forever start app.js"
  end

  desc "Restart Forever"
  task :restart, :roles => :app do
    stop
    sleep 5
    start
  end

  task :config_setup, :roles => :app do
    run "#{try_sudo} mkdir -p #{shared_path}/node_modules"
    run "#{try_sudo} chown -R #{user}:#{user} #{deploy_to}"
  end

  desc "Refresh shared node_modules symlink to current node_modules"
  task :refresh_symlink, :roles => :app do
    run "rm -rf #{current_path}/node_modules && ln -s #{shared_path}/node_modules #{current_path}/node_modules"
  end

  desc "Install node modules non-globally"
  task :npm_install, :roles => :app do
    run "cd #{current_path} && npm install -d"
  end

  desc "Send to the server the local configuration files"
  task :upload_config_files do
    top.upload "config_local.coffee", "#{release_path}/", :via => :scp
  end
end

after "deploy:setup", "deploy:config_setup"
after "deploy:update", "deploy:refresh_symlink"
after "deploy:update", "deploy:npm_install"
after "deploy:update", "deploy:upload_config_files"
after "deploy:update", "deploy:restart"
on :start, "deploy:info"
