#before run

# chmod +x run.sh
# sudo usermod -aG docker $USER
#restart daemon docker

docker compose down --remove-orphans
docker image prune -f
docker compose up --build