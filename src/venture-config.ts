import {
    dummyPaymentHandler,
    DefaultSearchPlugin,
    VendureConfig,
} from '@vendure/core';
import { defaultEmailHandlers, EmailPlugin } from '@vendure/email-plugin';
import { AssetServerPlugin, configureS3AssetStorage } from '@vendure/asset-server-plugin';
import { DefaultAssetNamingStrategy } from '@vendure/core';
import { fromEnv } from '@aws-sdk/credential-providers';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import 'dotenv/config';
import path from 'path';

// Import BullMQ plugin
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';

const IS_DEV = process.env.APP_ENV === 'dev';

export const config: VendureConfig = {
    apiOptions: {
        port: +(process.env.PORT || 3000),
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        ...(IS_DEV
            ? {
                  adminApiPlayground: {
                      settings: { 'request.credentials': 'include' } as any,
                  },
                  adminApiDebug: true,
                  shopApiPlayground: {
                      settings: { 'request.credentials': 'include' } as any,
                  },
                  shopApiDebug: true,
              }
            : {}),
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
            secret: process.env.COOKIE_SECRET,
        },
    },
    dbConnectionOptions: {
        type: 'postgres',
        synchronize: true,
        migrations: [path.join(__dirname, './migrations/*.+(ts|js)')],
        logging: false,
        database: process.env.DB_NAME,
        schema: process.env.DB_SCHEMA,
        host: process.env.DB_HOST,
        url: process.env.DB_URL,
        port: +process.env.DB_PORT,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_CA_CERT
            ? {
                  ca: process.env.DB_CA_CERT,
              }
            : undefined,
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    customFields: {
        Product: [
            {
                name: 'type',
                type: 'string',
            },
            {
                name: 'upc',
                type: 'string',
                unique: true,
            },
            {
                name: 'sku2',
                type: 'string',
                unique: true,
            },
            {
                name: 'weight',
                type: 'float',
            },
        ],
    },
    plugins: [
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, 'assets'),
            namingStrategy: new DefaultAssetNamingStrategy(),
            storageStrategyFactory: configureS3AssetStorage({
                bucket: 'venduretest',
                credentials: fromEnv(), 
                nativeS3Configuration: {
                    region: process.env.AWS_REGION,
                },
            }),
        }),

        // Remove DefaultJobQueuePlugin and add BullMQJobQueuePlugin instead
        // DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),

        BullMQJobQueuePlugin.init({
            // Use your Redis connection details here:
            connection: {
                host: 'venture-test_vendure-redis-test',
                port: 6379,
                username: 'default',
                password: '2653a8b81def45563b3b',
            },
            workerOptions: {
                concurrency: 100, // Increase concurrency as needed
            },
        }),

        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        
        EmailPlugin.init({
            devMode: true,
            outputPath: path.join(__dirname, '../static/email/test-emails'),
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templatePath: path.join(__dirname, '../static/email/templates'),
            globalTemplateVars: {
                fromAddress: '"example" <noreply@example.com>',
                verifyEmailAddressUrl: 'http://localhost:8080/verify',
                passwordResetUrl: 'http://localhost:8080/password-reset',
                changeEmailAddressUrl: 'http://localhost:8080/verify-email-address-change',
            },
        }),
        AdminUiPlugin.init({
            route: 'admin',
            port: 3002,
        }),
    ],
};
