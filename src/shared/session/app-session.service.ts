import { AbpMultiTenancyService, UtilsService } from 'abp-ng2-module';
import { Injectable } from '@angular/core';
import {
    ApplicationInfoDto,
    GetCurrentLoginInformationsOutput,
    SessionServiceProxy,
    TenantLoginInfoDto,
    UserLoginAttemptsInforDto,
    UserLoginAttemptsService,
    UserLoginInfoDto,
    UserServiceProxy
} from '@shared/service-proxies/service-proxies';
import { AppConsts } from '@shared/AppConsts';
import { finalize } from 'rxjs/operators';

@Injectable()
export class AppSessionService {

    private _user: UserLoginInfoDto;
    private _tenant: TenantLoginInfoDto;
    private _application: ApplicationInfoDto;
    browserName: string;
    browserVersion: string;
    userAgent: string;

    constructor(
        private _sessionService: SessionServiceProxy,
        private _utilsService: UtilsService,
        private _userLoginAttemptsService: UserLoginAttemptsService,
        private _userService: UserServiceProxy,
        private _abpMultiTenancyService: AbpMultiTenancyService) {
    }

    get application(): ApplicationInfoDto {
        return this._application;
    }

    get user(): UserLoginInfoDto {
        return this._user;
    }

    get userId(): number {
        return this.user ? this.user.id : null;
    }

    get tenant(): TenantLoginInfoDto {
        return this._tenant;
    }

    get tenantId(): number {
        return this.tenant ? this.tenant.id : null;
    }

    getShownLoginName(): string {
        const userName = this._user.userName;
        if (!this._abpMultiTenancyService.isEnabled) {
            return userName;
        }

        return (this._tenant ? this._tenant.tenancyName : '.') + '\\' + userName;
    }

    init(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this._sessionService.getCurrentLoginInformations().toPromise().then((result: GetCurrentLoginInformationsOutput) => {
                this._application = result.application;
                this._user = result.user;
                this._tenant = result.tenant;
                const curr_securityStamp = this._utilsService.getCookieValue(AppConsts.authorization.encryptedSecurityStamp);
                if(!!this._user){
                    if(!!curr_securityStamp && curr_securityStamp != this._user.securityStamp){
                        console.log("securityStamp changed. logout-------------------!!!!!!!!!!!!!!!!!!!!!")
                        this.logout();
                        return resolve(false);
                    }
                    this._userLoginAttemptsService
                        .getUserLoginAttempt(
                            this._user.userName
                        )
                        .subscribe((result: UserLoginAttemptsInforDto) => {
                            if(!!result && !!result.browserInfo && result.browserInfo != navigator.userAgent ){
                                console.log("browser errorr. logout-------------------!!!!!!!!!!!!!!!!!!!!!", result)
                                this.logout();
                                return resolve(false);
                            }
                        });
                    this._utilsService.setCookieValue(
                        AppConsts.authorization.encryptedSecurityStamp,
                        this._user.securityStamp,
                        new Date(new Date().getTime() + 5 * 365 * 86400000),
                        abp.appPath
                    );
                }
                
                resolve(true);
            }, (err) => {
                reject(err);
            });
        });
    }
    // this.userAgent = navigator.userAgent;

    changeTenantIfNeeded(tenantId?: number): boolean {
        if (this.isCurrentTenant(tenantId)) {
            return false;
        }

        abp.multiTenancy.setTenantIdCookie(tenantId);
        location.reload();
        return true;
    }

    private isCurrentTenant(tenantId?: number) {
        if (!tenantId && this.tenant) {
            return false;
        } else if (tenantId && (!this.tenant || this.tenant.id !== tenantId)) {
            return false;
        }

        return true;
    }
    private async logout(reload?: boolean){
        await this._userService
        .updateLoginState(
            this.userId
        )
        .subscribe((result) => {
            abp.auth.clearToken();
            abp.utils.deleteCookie(AppConsts.authorization.encryptedAuthTokenName);
            if (reload !== false) {
                location.href = AppConsts.appBaseUrl;
            }
        });
    }
}
