import http from 'http';

http.get('http://localhost:3000/es', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // find a product link
        const match = data.match(/\/es\/product\/([a-zA-Z0-9_-]+)/);
        if (match) {
            console.log("Found product:", match[1]);
            http.get('http://localhost:3000/es/product/' + match[1], (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    const errorMatch = data2.match(/Application error/);
                    console.log("Status:", res2.statusCode);
                    if (errorMatch) {
                        console.log("Error on product page!");
                    } else {
                        console.log("Product page loaded successfully.");
                    }
                })
            });
        } else {
            console.log("No product found on homepage");
        }
    });
}).on('error', err => console.error(err));
