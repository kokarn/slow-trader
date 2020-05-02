# slow-trader

Configuration lives in environment.

## Config vars
`AVANZA_USERNAME`  
string  
the username to login with

`AVANZA_PASSWORD`  
string  
the password to login with

`AVANZA_TOTP_SECRET`  
string  
avanza totp secret configured by [the totp setup](https://github.com/fhqvst/avanza#getting-a-totp-secret)

`AVANZA_ISK_ID`  
number  
the account to use for trading

`BUY_INDICATORS`  
string  
comma separated list of what buy indicators to use.  
available: `timer`, `sell`, `winners`

`SELL_THRESHOLD_PERCENT`  
number  
target percent profit to hit on a stock before selling

