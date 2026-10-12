FROM nginx:alpine AS development

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

FROM development AS production

COPY index.html privacypolicy.html background.jpg /usr/share/nginx/html/
COPY Game/ /usr/share/nginx/html/Game/
