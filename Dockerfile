FROM node:14-alpine

RUN apk add tzdata
RUN cp /usr/share/zoneinfo/Europe/Stockholm /etc/localtime
RUN echo "Europe/Stockholm" >  /etc/timezone

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

CMD [ "npm", "start" ]
