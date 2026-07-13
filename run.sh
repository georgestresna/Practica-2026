#before run

# chmod +x run.sh
# sudo usermod -aG docker $USER
# sudo apt install util-linux-extra
# newgrp docker

docker compose down --remove-orphans
docker image prune -f
docker compose up --build