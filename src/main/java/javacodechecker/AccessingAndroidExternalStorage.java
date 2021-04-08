package javacodechecker;

import android.content.Context;
import android.os.Environment;

public class AccessingAndroidExternalStorage {

    public void accessFiles(Context context) {
    	// EMB-ISSUE: CodeIssueNames.ACCESSING_ANDROID_EXTERNAL_STORAGE
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES); // Sensitive
    	// EMB-ISSUE: CodeIssueNames.ACCESSING_ANDROID_EXTERNAL_STORAGE
        context.getExternalFilesDir(Environment.DIRECTORY_PICTURES); // Sensitive
    }
}
