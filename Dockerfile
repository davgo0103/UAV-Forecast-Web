FROM php:apache

RUN a2enmod rewrite ssl proxy proxy_http

RUN mkdir /etc/apache2/ssl

RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/apache2/ssl/server.key \
  -out /etc/apache2/ssl/server.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/OU=Department/CN=localhost"

RUN echo '<VirtualHost *:443>\n\
    DocumentRoot "/var/www/html"\n\
    ServerName localhost\n\
    SSLEngine on\n\
    SSLCertificateFile /etc/apache2/ssl/server.crt\n\
    SSLCertificateKeyFile /etc/apache2/ssl/server.key\n\
    SSLProxyEngine On\n\
    SSLProxyVerify none\n\
    SSLProxyCheckPeerCN off\n\
    SSLProxyCheckPeerName off\n\
    ProxyRequests Off\n\
    <Proxy *>\n\
        Require all granted\n\
    </Proxy>\n\
    <Directory "/var/www/html">\n\
        AllowOverride All\n\
    </Directory>\n\
</VirtualHost>\n\
<VirtualHost *:80>\n\
    DocumentRoot "/var/www/html"\n\
    ServerName localhost\n\
    SSLProxyEngine On\n\
    SSLProxyVerify none\n\
    SSLProxyCheckPeerCN off\n\
    SSLProxyCheckPeerName off\n\
    ProxyRequests Off\n\
    <Proxy *>\n\
        Require all granted\n\
    </Proxy>\n\
    <Directory "/var/www/html">\n\
        AllowOverride All\n\
    </Directory>\n\
</VirtualHost>' > /etc/apache2/sites-available/000-default.conf
