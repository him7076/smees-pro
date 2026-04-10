import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Capacitor } from '@capacitor/core';

export const usePushNotifications = (user) => {
    useEffect(() => {
        if (!user || !Capacitor.isNativePlatform()) return;

        const registerPush = async () => {
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn('User denied permissions!');
                return;
            }

            await PushNotifications.register();
        };

        const addListeners = async () => {
            await PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token: ' + token.value);
                
                // Save token to Firestore
                try {
                    const info = await Device.getInfo();
                    const deviceId = (await Device.getId()).identifier;
                    
                    const tokenRef = doc(db, 'users', user.uid, 'tokens', deviceId);
                    await setDoc(tokenRef, {
                        token: token.value,
                        platform: info.platform,
                        model: info.model,
                        lastUpdated: new Date().toISOString()
                    }, { merge: true });
                    
                } catch (e) {
                    console.error('Error saving token to firestore', e);
                }
            });

            await PushNotifications.addListener('registrationError', (err) => {
                console.error('Registration error: ' + err.error);
            });

            await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received: ' + JSON.stringify(notification));
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Push action performed: ' + JSON.stringify(notification));
            });
        };

        registerPush();
        addListeners();

        return () => {
            PushNotifications.removeAllListeners();
        };
    }, [user]);
};
