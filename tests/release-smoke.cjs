'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const assets = path.resolve(__dirname, '../app/src/main/assets');
const artifactDirectory = process.env.RELEASE_MEDIA_DIR;
const mimeTypes = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    png: 'image/png',
    svg: 'image/svg+xml',
    ttf: 'font/ttf'
};
const server = http.createServer((request, response) => {
    const filename = request.url === '/' ? 'index.html' : request.url.slice(1);
    if (!fs.readdirSync(assets).includes(filename)) {
        response.writeHead(404);
        response.end();
        return;
    }
    response.setHeader('Content-Type', mimeTypes[filename.split('.').pop()] || 'text/plain');
    response.end(fs.readFileSync(path.join(assets, filename)));
});

async function run() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-gpu']
    });
    try {
        const context = await browser.newContext({
            viewport: { width: 450, height: 800 },
            deviceScaleFactor: 2
        });
        await context.addInitScript(() => {
            window.nativeExports = [];
            window.Android = {
                readState: key => localStorage.getItem(key),
                writeState(key, value) {
                    localStorage.setItem(key, value);
                    return true;
                },
                archiveDocument(data, id, paper) {
                    window.nativeExports.push({ data: JSON.parse(data), id, paper });
                },
                storedDocument(data, name, paper, mode, id) {
                    window.lastDocument = { data: JSON.parse(data), name, paper, mode, id };
                },
                save(name, mime, data) {
                    window.lastSavedFile = { name, mime, data };
                },
                pickContact() {
                    receiveContact('مشتری نمونه', '+98 912 000 0000');
                }
            };
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        const click = label => page.getByRole('button', { name: label, exact: true }).click();
        const field = name => page.locator('[name="' + name + '"]');
        const screenshot = async filename => {
            if (!artifactDirectory) return;
            await page.locator('#notice').waitFor({ state: 'hidden' });
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: path.join(artifactDirectory, filename) });
        };

        await page.goto('http://127.0.0.1:' + server.address().port);
        assert.equal(await page.title(), 'فاکتورچین');
        await click('رد کردن');

        // Personal details can be left empty. The publisher receives no account data.
        await field('name').fill('فروشگاه نمونه');
        await field('businessPreset').selectOption('install');
        await click('مطالعهٔ حریم خصوصی');
        await click('بازگشت به تنظیمات');
        assert.equal(await field('name').inputValue(), 'فروشگاه نمونه');
        await field('acceptPrivacy').check();
        await click('شروع استفاده از فاکتورچین');
        assert.equal(await page.evaluate('db.registration.completed'), true);
        assert.equal(await page.evaluate('db.registration.mobile'), '');
        await page.reload();
        assert.equal(await field('name').count(), 0);

        await click('فاکتور جدید');
        await field('customer').fill('مشتری نمونه');
        await field('billPrice').fill('۸۰۰۰۰۰۰');
        await field('documentTitle').fill('فاکتور فروش');
        await field('delivery').selectOption('حضوری');
        await field('billQty').fill('1');

        // Changing the job updates a draft without losing entered customer/amount.
        await page.evaluate("go('business')");
        await field('businessPreset').selectOption('food');
        await click('ذخیرهٔ فعالیت');
        await click('فاکتور جدید');
        assert.match(await page.locator('.editor-kicker').innerText(), /رستوران/);
        assert.equal(await field('customer').inputValue(), 'مشتری نمونه');
        assert.equal(await field('billPrice').inputValue(), '۸۰۰۰۰۰۰');
        await field('billName').fill('پذیرایی سفارش');
        await click('انتخاب از مخاطبان گوشی');
        assert.equal(await field('phone').inputValue(), '09120000000');
        await field('phone').fill('');
        await field('paymentMode').selectOption('اقساطی');
        await field('installmentCount').selectOption('3');
        await field('planAdvance').fill('۲۰۰۰۰۰۰');
        await field('due0').fill('۱۴۰۵/۱۰/۰۱');
        await field('due1').fill('۱۴۰۵/۱۱/۰۱');
        await field('due2').fill('۱۴۰۵/۱۲/۰۱');

        await context.setOffline(true);
        await click('ذخیرهٔ فاکتور و PDF');
        assert.equal(await page.locator('.formal-items thead th').count(), 6);
        const document = await page.evaluate('db.docs.at(-1)');
        assert.equal(document.type, 'فاکتور فروش');
        assert.equal(document.paymentPlan.installments.length, 3);
        assert.equal(document.paymentPlan.installments.reduce((sum, item) => sum + item.amount, 0), 60_000_000);
        assert.equal(await page.evaluate('db.orders.at(-1).payments.length'), 0);
        assert.match(await page.locator('.payment-plan').innerText(), /قسط ۳/);
        const pdfInput = await page.evaluate('window.nativeExports.at(-1).data');
        assert.match(pdfInput.note, /اقساطی/);
        assert.equal(pdfInput.rows[0].length, 6);
        await context.setOffline(false);

        await click('ذخیرهٔ فایل PDF');
        assert.equal(await page.evaluate('window.lastDocument.mode'), 'save');
        await page.getByText('ثبت پرداخت', { exact: true }).click();
        await field('amount').fill('۸۰۰۰۰۰۱');
        await click('ذخیرهٔ پرداخت');
        assert.match(await page.locator('.bill-payment .error').innerText(), /مانده/);
        await field('amount').fill('۳۰۰۰۰۰۰');
        await click('ذخیرهٔ پرداخت');
        assert.equal(await page.locator('[data-balance]').innerText(), '۵٬۰۰۰٬۰۰۰ تومان');
        await screenshot('02-payments.png');
        await page.locator('.formal-sheet').scrollIntoViewIfNeeded();
        await screenshot('03-invoice.png');
        await page.locator('.payment-plan').scrollIntoViewIfNeeded();
        await screenshot('04-installments.png');

        await click('خانه');
        await screenshot('01-home.png');
        await field('quickSearch').fill('نمونه');
        assert.equal(await page.locator('#dashboard-results .archive-row').count(), 1);
        await click('باز کردن منو');
        assert.match(await page.locator('.menu-brand').innerText(), /هر فاکتور، یک خیال آسوده/);
        await screenshot('05-menu.png');
        await page.locator('.workspace-menu').getByRole('button', { name: 'گزارش فروش و دریافتی', exact: true }).click();
        assert.match(await page.locator('#app').innerText(), /۵٬۰۰۰٬۰۰۰/);
        await screenshot('06-report.png');

        await page.evaluate("go('billArchive')");
        await field('invoice-search').fill('نمونه');
        await page.locator('.archive-row').click();
        await click('فاکتور جدید از روی این فاکتور');
        await field('paymentMode').selectOption('چکی');
        await field('checkDue').fill('۱۴۰۵/۱۲/۰۲');
        await field('checkNumber').fill('۱۲۳۴۵۶');
        await click('ذخیرهٔ فاکتور و PDF');
        assert.equal(await page.evaluate('db.docs.at(-1).paymentPlan.mode'), 'چکی');
        assert.equal(await page.evaluate('db.orders.at(-1).payments.length'), 0);

        // A complete backup round-trip keeps payment plans and local registration.
        const backup = await page.evaluate(async () => {
            return new TextDecoder().decode(await packBackup(db, 'sample-password'));
        });
        await page.evaluate(async backup => {
            stagedBackup = await unpackBackup(backup, 'sample-password');
            await restoreBackup();
        }, backup);
        assert.equal(await page.evaluate('db.orders.length'), 2);
        assert.equal(await page.evaluate('db.docs[0].paymentPlan.installments.length'), 3);
        const beforeBadRestore = await page.evaluate('JSON.stringify(db)');
        const rejected = await page.evaluate(async () => {
            try {
                await unpackBackup('{"format":"sefareshyar-1","data":{}}', '');
                return false;
            } catch {
                return true;
            }
        });
        assert.equal(rejected, true);
        assert.equal(await page.evaluate('JSON.stringify(db)'), beforeBadRestore);

        await page.evaluate("go('privacy')");
        assert.match(await page.locator('#app').innerText(), /اختیاری/);
        await page.reload();
        assert.equal(await page.evaluate('db.orders.length'), 2);
        assert.equal(await page.evaluate('db.registration.completed'), true);
        assert.deepEqual(errors, []);

        if (artifactDirectory) {
            const icon = await page.evaluate(async () => {
                const image = new Image();
                image.src = 'brand-mascot.png';
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 512;
                canvas.getContext('2d').drawImage(image, 0, 0, 512, 512);
                return canvas.toDataURL('image/png').split(',')[1];
            });
            fs.writeFileSync(path.join(artifactDirectory, 'icon-512.png'), Buffer.from(icon, 'base64'));
        }
        console.log('PASS: guest start, upgrade persistence, job change, contacts callback, offline invoices, PDF payload, payments, instalments, cheque, reports, backup recovery and privacy.');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

