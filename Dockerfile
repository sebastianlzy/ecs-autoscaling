#FROM node:14-buster-slim
FROM public.ecr.aws/docker/library/node:14-buster-slim
ENV NODE_ENV=production

WORKDIR /app

COPY ["./queue-processing-node-app/package.json", "./queue-processing-node-app/package-lock.json*", "./"]

RUN echo $(ls ) && npm install --production

COPY ./queue-processing-node-app .
EXPOSE 3000

CMD [ "node", "index.js" ]